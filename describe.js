/**
 * Describe tab logic for the Preset Builder extension.
 * Handles generation, draft preview, editing, explanation, and download.
 *
 * Generation flow:
 * 1. Claude returns focused JSON (prompts + parameters only)
 * 2. assemblePreset() merges Claude's output into the boilerplate template
 * 3. The full preset is displayed in the editable draft UI
 */

import {
    buildGenerationPrompt,
    buildAuditPrompt,
    buildExplanationPrompt,
    buildPass1PlanPrompt,
    buildPass2ContentPrompt,
    buildPass2BatchPrompt
} from './prompts.js';
import { getBasePresetTemplate } from './preset-template.js';
import { getSettings, saveSettings } from './index.js';

/** @type {object|null} The current full assembled preset */
let currentDraft = null;

/** @type {boolean} Whether a generation is in progress */
let isGenerating = false;

const ROLES = ['system', 'user', 'assistant'];

const SYSTEM_IDENTIFIERS = new Set([
    'main', 'nsfw', 'jailbreak', 'chatHistory', 'dialogueExamples',
    'charDescription', 'charPersonality', 'scenario',
    'personaDescription', 'worldInfoBefore', 'worldInfoAfter',
    'enhanceDefinitions',
]);

/**
 * Escape all SillyTavern macros in a string by replacing {{...}} patterns
 * with safe placeholders that won't trigger the macro parser.
 * Returns the escaped string and a map to restore originals.
 * @param {string} text - The text containing macros to escape
 * @returns {{escaped: string, macroMap: Object}} The escaped text and restoration map
 */
function escapeMacros(text) {
    const macroMap = {};
    let counter = 0;

    // Match all {{...}} patterns, including nested ones
    const escaped = text.replace(/\{\{[^}]*\}\}/g, (match) => {
        const placeholder = `__MACRO_${counter}__`;
        macroMap[placeholder] = match;
        counter++;
        return placeholder;
    });

    return { escaped, macroMap };
}

/**
 * Restore original macros from placeholders in a string.
 * @param {string} text - The text with placeholders
 * @param {Object} macroMap - The map of placeholders to original macros
 * @returns {string} The text with macros restored
 */
function restoreMacros(text, macroMap) {
    let result = text;
    for (const [placeholder, original] of Object.entries(macroMap)) {
        result = result.replaceAll(placeholder, original);
    }
    return result;
}

/**
 * Restore macros in an entire preset content result object.
 * Handles the prompts array and top-level prompt fields.
 * @param {Object} contentResult - The preset content object
 * @param {Object} macroMap - The map of placeholders to original macros
 * @returns {Object} The content with macros restored
 */
function restoreMacrosInPreset(contentResult, macroMap) {
    if (!contentResult || !macroMap || Object.keys(macroMap).length === 0) {
        return contentResult;
    }

    if (contentResult.main_prompt) {
        contentResult.main_prompt = restoreMacros(contentResult.main_prompt, macroMap);
    }
    if (contentResult.nsfw_prompt) {
        contentResult.nsfw_prompt = restoreMacros(contentResult.nsfw_prompt, macroMap);
    }
    if (contentResult.jailbreak_prompt) {
        contentResult.jailbreak_prompt = restoreMacros(contentResult.jailbreak_prompt, macroMap);
    }
    if (contentResult.prompts) {
        for (const prompt of contentResult.prompts) {
            if (prompt.content) {
                prompt.content = restoreMacros(prompt.content, macroMap);
            }
        }
    }

    return contentResult;
}

/**
 * Initialize event listeners for the Describe tab.
 */
export function initDescribeTab() {
    // Quick tags
    $('#pb-description-input').parent().on('click', '.pb-tag', function () {
        const tag = $(this).data('tag');
        const textarea = $('#pb-description-input');
        const current = textarea.val().trim();
        if (current.toLowerCase().includes(tag.toLowerCase())) {
            $(this).toggleClass('selected');
            return;
        }
        $(this).addClass('selected');
        textarea.val(current ? `${current}, ${tag}` : tag);
    });

    // Generate button
    $('#pb-generate-btn').on('click', () => {
        const description = $('#pb-description-input').val().trim();
        if (!description) {
            toastr.warning('Please enter a description of the preset you want to generate.');
            return;
        }
        generatePreset(description);
    });

    // Regenerate button
    $('#pb-regenerate-btn').on('click', () => {
        const description = $('#pb-description-input').val().trim();
        if (!description) {
            toastr.warning('No description to regenerate from.');
            return;
        }
        generatePreset(description);
    });

    // Explain button
    $('#pb-explain-btn').on('click', () => explainPreset());

    // Explanation close
    $('#pb-explanation-close').on('click', () => {
        $('#pb-explanation-panel').slideUp(200);
    });

    // Download button
    $('#pb-download-btn').on('click', () => downloadPreset());

    // Add prompt button
    $('#pb-add-prompt-btn').on('click', () => addBlankPrompt());

    // Self-audit toggle
    $('#pb-self-audit-toggle').on('change', function () {
        const settings = getSettings();
        settings.selfAuditEnabled = $(this).is(':checked');
        saveSettings();
    });

    // Restore last description
    const settings = getSettings();
    if (settings.lastDescription) {
        $('#pb-description-input').val(settings.lastDescription);
    }
    $('#pb-self-audit-toggle').prop('checked', settings.selfAuditEnabled);
}

/**
 * Main generation flow: Two-pass generation to avoid truncation.
 * Pass 1: Generate structural plan
 * Pass 2: Generate full content based on plan
 * @param {string} description
 */
async function generatePreset(description) {
    if (isGenerating) {
        toastr.info('Generation already in progress.');
        return;
    }

    isGenerating = true;
    const settings = getSettings();
    settings.lastDescription = description;
    saveSettings();

    // Show progress, hide previous draft
    $('#pb-progress').show();
    $('#pb-draft-preview').hide();
    $('#pb-explanation-panel').hide();
    updateProgress('Analyzing description...');

    try {
        const { generateRaw } = SillyTavern.getContext();

        // PASS 1: Generate structural plan
        updateProgress('Generating preset blueprint...');
        const pass1Prompt = buildPass1PlanPrompt(description);
        const { escaped: escapedPass1Prompt, macroMap: pass1MacroMap } = escapeMacros(pass1Prompt);
        const pass1Result = await generateRaw({
            prompt: escapedPass1Prompt,
            systemPrompt: '',
            responseLength: 45000,
        });

        if (!pass1Result) {
            throw new Error('Generation returned empty result. Make sure you have an LLM API configured.');
        }

        const planJson = extractJson(pass1Result);
        const plan = parseJsonSafe(planJson);

        // Validate plan structure
        if (!plan.prompt_plan || !Array.isArray(plan.prompt_plan)) {
            throw new Error('Invalid plan structure: missing prompt_plan array');
        }

        const promptCount = plan.prompt_plan.length;
        updateProgress(`Blueprint ready: ${promptCount} prompts planned. Generating content...`);

        // PASS 2: Generate full content
        let focusedOutput;

        // Determine if we need batching (if plan has > 25 prompts, use batching to be safe)
        if (promptCount > 25) {
            focusedOutput = await generateContentInBatches(plan, description, generateRaw);
        } else {
            updateProgress('Writing prompt content...');
            const pass2Prompt = buildPass2ContentPrompt(plan, description);
            const { escaped: escapedPass2Prompt, macroMap: pass2MacroMap } = escapeMacros(pass2Prompt);
            const pass2Result = await generateRaw({
                prompt: escapedPass2Prompt,
                systemPrompt: '',
                responseLength: 45000,
            });

            if (!pass2Result) {
                throw new Error('Content generation returned empty result.');
            }

            const contentJson = extractJson(pass2Result);
            const content = parseJsonSafe(contentJson);

            // Restore macros in the generated content
            const restoredContent = restoreMacrosInPreset(content, pass2MacroMap);

            // Merge content with plan to create focused output
            focusedOutput = {
                parameters: plan.parameters,
                main_prompt: restoredContent.main_prompt || '',
                nsfw_prompt: restoredContent.nsfw_prompt || '',
                jailbreak_prompt: restoredContent.jailbreak_prompt || '',
                prompts: restoredContent.prompts || [],
                prompt_order: plan.prompt_order_plan.map(name => ({
                    identifier: name,
                    enabled: true
                }))
            };
        }

        // Step 3: Self-audit on the focused output (if enabled)
        if (settings.selfAuditEnabled) {
            updateProgress('Running quality check...');
            const focusedJson = JSON.stringify(focusedOutput);
            const { escaped: escapedFocusedJson, macroMap: auditMacroMap } = escapeMacros(focusedJson);
            const auditPrompt = buildAuditPrompt(escapedFocusedJson, description);
            const auditResult = await generateRaw({
                prompt: auditPrompt,
                systemPrompt: '',
                responseLength: 45000,
            });

            if (auditResult) {
                try {
                    const auditJson = extractJson(auditResult);
                    const audited = parseJsonSafe(auditJson);
                    // Restore macros in the audited content
                    const restoredAudited = restoreMacrosInPreset(audited, auditMacroMap);
                    focusedOutput = restoredAudited;
                } catch {
                    console.warn('[PresetBuilder] Audit response was not valid JSON, using original.');
                }
            }
        }

        // Step 4: Assemble full preset from focused output + boilerplate
        updateProgress('Assembling preset...');
        const fullPreset = assemblePreset(focusedOutput);

        // Step 5: Display draft
        currentDraft = fullPreset;
        renderDraftPreview(fullPreset);
        $('#pb-draft-preview').slideDown(300);
        toastr.success('Preset generated successfully!');
    } catch (err) {
        console.error('[PresetBuilder] Generation failed:', err);
        toastr.error(`Generation failed: ${err.message}`);
    } finally {
        isGenerating = false;
        $('#pb-progress').hide();
    }
}

/**
 * Generate content in batches to avoid truncation for very large presets.
 * @param {object} plan - The plan from Pass 1
 * @param {string} description - Original user description
 * @param {Function} generateRaw - The generateRaw function from SillyTavern
 * @returns {object} The focused output with all content generated
 */
async function generateContentInBatches(plan, description, generateRaw) {
    const BATCH_SIZE = 10;
    const promptPlan = plan.prompt_plan;
    const totalBatches = Math.ceil(promptPlan.length / BATCH_SIZE);
    const allPrompts = [];

    // Generate main, nsfw, and jailbreak prompts first (single call)
    updateProgress('Writing core prompts...');
    const corePrompt = `You are a SillyTavern preset content writer. Generate the core prompts based on this plan:

USER DESCRIPTION: ${description}

PLAN SUMMARIES:
- main_prompt_summary: ${plan.main_prompt_summary}
- nsfw_prompt_summary: ${plan.nsfw_prompt_summary}
- jailbreak_prompt_summary: ${plan.jailbreak_prompt_summary}

Return JSON:
{
  "main_prompt": "<full content>",
  "nsfw_prompt": "<full content or empty string>",
  "jailbreak_prompt": "<full content>"
}

Use SillyTavern macros: {{char}}, {{user}}, {{lastUserMessage}}, {{personality}}, {{scenario}}, {{description}}, {{persona}}.
Return ONLY the JSON object.`;

    const { escaped: escapedCorePrompt, macroMap: coreMacroMap } = escapeMacros(corePrompt);
    const coreResult = await generateRaw({
        prompt: escapedCorePrompt,
        systemPrompt: '',
        responseLength: 45000,
    });

    const coreJson = extractJson(coreResult);
    const coreContent = parseJsonSafe(coreJson);

    // Restore macros in core content
    const restoredCoreContent = restoreMacrosInPreset(coreContent, coreMacroMap);

    // Generate custom prompts in batches
    for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, promptPlan.length);
        const batch = promptPlan.slice(start, end);

        updateProgress(`Writing content batch ${i + 1}/${totalBatches}...`);

        const batchPrompt = buildPass2BatchPrompt(plan, batch, description, i + 1, totalBatches);
        const { escaped: escapedBatchPrompt, macroMap: batchMacroMap } = escapeMacros(batchPrompt);
        const batchResult = await generateRaw({
            prompt: escapedBatchPrompt,
            systemPrompt: '',
            responseLength: 45000,
        });

        if (!batchResult) {
            console.warn(`[PresetBuilder] Batch ${i + 1} returned empty, skipping`);
            continue;
        }

        const batchJson = extractJson(batchResult);
        const batchContent = parseJsonSafe(batchJson);

        // batchContent should be an array of prompt objects
        if (Array.isArray(batchContent)) {
            // Restore macros in each prompt
            for (const prompt of batchContent) {
                if (prompt.content) {
                    prompt.content = restoreMacros(prompt.content, batchMacroMap);
                }
            }
            allPrompts.push(...batchContent);
        } else {
            console.warn(`[PresetBuilder] Batch ${i + 1} did not return an array, skipping`);
        }
    }

    // Assemble the focused output
    return {
        parameters: plan.parameters,
        main_prompt: restoredCoreContent.main_prompt || '',
        nsfw_prompt: restoredCoreContent.nsfw_prompt || '',
        jailbreak_prompt: restoredCoreContent.jailbreak_prompt || '',
        prompts: allPrompts,
        prompt_order: plan.prompt_order_plan.map(name => ({
            identifier: name,
            enabled: true
        }))
    };
}

/**
 * Parse JSON with truncation detection and a simple repair attempt.
 * @param {string} jsonStr
 * @returns {object}
 */
function parseJsonSafe(jsonStr) {
    try {
        return JSON.parse(jsonStr);
    } catch (firstError) {
        // Check for truncation — the response ends without proper closure
        const trimmed = jsonStr.trimEnd();
        if (!trimmed.endsWith('}')) {
            console.warn('[PresetBuilder] JSON appears truncated, attempting repair...');
            const repaired = tryRepairJson(trimmed);
            if (repaired) {
                toastr.warning('The LLM response was truncated. A partial preset was recovered — review carefully.');
                return repaired;
            }
            throw new Error(
                'The LLM response was truncated (JSON cut off mid-output). ' +
                'Try simplifying your description or disabling the self-audit pass.',
            );
        }
        throw firstError;
    }
}

/**
 * Attempt to repair truncated JSON by closing open structures.
 * Improved version with better string handling and structure tracking.
 * @param {string} json
 * @returns {object|null}
 */
function tryRepairJson(json) {
    let truncated = json.trimEnd();

    // Track state while scanning
    let inString = false;
    let escaped = false;
    let braceCount = 0;
    let bracketCount = 0;

    for (let i = 0; i < truncated.length; i++) {
        const char = truncated[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
    }

    // If we were inside a string, close it
    if (inString) {
        truncated += '"';
    }

    // Remove trailing comma if present (before closing structures)
    truncated = truncated.replace(/,\s*$/, '');

    // Close any open brackets and braces
    while (bracketCount > 0) {
        truncated += ']';
        bracketCount--;
    }
    while (braceCount > 0) {
        truncated += '}';
        braceCount--;
    }

    try {
        return JSON.parse(truncated);
    } catch (e) {
        console.warn('[PresetBuilder] Truncation repair failed:', e.message);
        return null;
    }
}

/**
 * Merge Claude's focused output into the full boilerplate preset template.
 * @param {object} claudeOutput - The focused JSON from Claude.
 * @returns {object} The complete preset object.
 */
function assemblePreset(claudeOutput) {
    const preset = getBasePresetTemplate();

    // Merge generation parameters
    if (claudeOutput.parameters) {
        for (const [key, value] of Object.entries(claudeOutput.parameters)) {
            preset[key] = value;
        }
    }

    // Set top-level prompt fields
    preset.main_prompt = claudeOutput.main_prompt || '';
    preset.nsfw_prompt = claudeOutput.nsfw_prompt || '';
    preset.jailbreak_prompt = claudeOutput.jailbreak_prompt || '';

    // Build standard prompt entries with fixed identifiers
    const standardPrompts = [
        {
            identifier: 'main',
            name: 'Main Prompt',
            system_prompt: true,
            role: 'system',
            content: preset.main_prompt,
            enabled: true,
            marker: false,
            forbid_overrides: false,
            injection_trigger: [],
        },
        {
            identifier: 'nsfw',
            name: 'NSFW Prompt',
            system_prompt: true,
            role: 'system',
            content: preset.nsfw_prompt,
            enabled: Boolean(preset.nsfw_prompt),
            marker: false,
            forbid_overrides: false,
            injection_trigger: [],
        },
        {
            identifier: 'dialogueExamples',
            name: 'Chat Examples',
            system_prompt: true,
            role: 'system',
            content: '',
            enabled: true,
            marker: true,
            injection_trigger: [],
        },
        {
            identifier: 'chatHistory',
            name: 'Chat History',
            system_prompt: true,
            role: 'system',
            content: '',
            enabled: true,
            marker: true,
            injection_trigger: [],
        },
        {
            identifier: 'jailbreak',
            name: 'Post-History Instructions',
            system_prompt: true,
            role: 'system',
            content: preset.jailbreak_prompt,
            enabled: true,
            marker: false,
            forbid_overrides: false,
            injection_trigger: [],
        },
    ];

    // Process custom prompts — generate UUIDs, add boilerplate fields
    // Build a name→UUID map for prompt_order resolution
    const nameToUuid = new Map();
    const customPrompts = (claudeOutput.prompts || []).map(p => {
        const uuid = crypto.randomUUID();
        nameToUuid.set(p.name, uuid);
        return {
            identifier: uuid,
            name: p.name,
            enabled: p.enabled ?? true,
            injection_position: p.injection_position ?? 0,
            injection_depth: p.injection_depth ?? 4,
            injection_order: p.injection_order ?? 100,
            role: p.role || 'system',
            content: p.content || '',
            system_prompt: false,
            marker: false,
            forbid_overrides: false,
            injection_trigger: [],
        };
    });

    preset.prompts = [...standardPrompts, ...customPrompts];

    // Build prompt_order — resolve custom prompt names to UUIDs
    if (claudeOutput.prompt_order && Array.isArray(claudeOutput.prompt_order)) {
        const resolvedOrder = claudeOutput.prompt_order.map(entry => {
            // System identifiers stay as-is
            if (SYSTEM_IDENTIFIERS.has(entry.identifier)) {
                return { identifier: entry.identifier, enabled: entry.enabled ?? true };
            }
            // Custom prompt — find by name and replace with UUID
            const uuid = nameToUuid.get(entry.identifier);
            if (uuid) {
                return { identifier: uuid, enabled: entry.enabled ?? true };
            }
            // Unknown identifier — keep as-is (shouldn't happen, but safe)
            return entry;
        });
        preset.prompt_order = [{ character_id: 100001, order: resolvedOrder }];
    } else {
        // Fallback: build a default prompt_order
        preset.prompt_order = [{ character_id: 100001, order: buildDefaultPromptOrder(customPrompts) }];
    }

    return preset;
}

/**
 * Build a default prompt_order when Claude doesn't provide one.
 * @param {object[]} customPrompts
 * @returns {object[]}
 */
function buildDefaultPromptOrder(customPrompts) {
    const order = [
        { identifier: 'main', enabled: true },
        { identifier: 'nsfw', enabled: false },
        { identifier: 'charDescription', enabled: true },
        { identifier: 'charPersonality', enabled: true },
        { identifier: 'scenario', enabled: true },
        { identifier: 'personaDescription', enabled: true },
        { identifier: 'worldInfoBefore', enabled: true },
        { identifier: 'enhanceDefinitions', enabled: false },
        { identifier: 'dialogueExamples', enabled: true },
    ];

    // Insert custom prompts before chatHistory
    for (const p of customPrompts) {
        order.push({ identifier: p.identifier, enabled: p.enabled });
    }

    order.push(
        { identifier: 'chatHistory', enabled: true },
        { identifier: 'worldInfoAfter', enabled: true },
        { identifier: 'jailbreak', enabled: true },
    );

    return order;
}

/**
 * Extract JSON from a string that may contain markdown fences or extra text.
 * @param {string} raw
 * @returns {string}
 */
function extractJson(raw) {
    // Try to extract from markdown code fences
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
        return fenceMatch[1].trim();
    }

    // Try to find the JSON object directly
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return raw.substring(firstBrace, lastBrace + 1);
    }

    return raw.trim();
}

/**
 * Update the progress indicator text.
 * @param {string} text
 */
function updateProgress(text) {
    $('#pb-progress-text').text(text);
}

/**
 * Render the full draft preview from an assembled preset object.
 * @param {object} preset
 */
function renderDraftPreview(preset) {
    // Render prompt cards
    const $list = $('#pb-prompt-list').empty();
    const prompts = preset.prompts || [];
    for (const prompt of prompts) {
        $list.append(createPromptCard(prompt));
    }

    // Render parameters
    const paramFields = [
        'temperature', 'top_p', 'top_k', 'min_p',
        'openai_max_context', 'openai_max_tokens',
        'frequency_penalty', 'presence_penalty',
    ];
    for (const field of paramFields) {
        const val = preset[field];
        if (val !== undefined) {
            $(`#pb-param-${field}`).val(val);
        }
    }
}

/**
 * Create a prompt card jQuery element.
 * @param {object} prompt
 * @returns {JQuery}
 */
function createPromptCard(prompt) {
    const isMarker = prompt.marker === true;
    const id = prompt.identifier || crypto.randomUUID();
    const depthInfo = prompt.injection_depth !== undefined ? `depth: ${prompt.injection_depth}` : '';
    const orderInfo = prompt.injection_order !== undefined ? `order: ${prompt.injection_order}` : '';
    const metaText = [depthInfo, orderInfo].filter(Boolean).join(', ');

    const $card = $(`
        <div class="pb-prompt-card ${isMarker ? 'is-marker' : ''}" data-identifier="${id}">
            <div class="pb-prompt-card-header">
                <input type="checkbox" class="pb-prompt-toggle" ${prompt.enabled ? 'checked' : ''} title="Enable/disable">
                <input type="text" class="pb-prompt-name text_pole" value="${escapeAttr(prompt.name || '')}" ${isMarker ? 'readonly' : ''}>
                <span class="pb-role-badge" data-role="${prompt.role || 'system'}" title="Click to cycle role">${prompt.role || 'system'}</span>
                ${metaText ? `<span class="pb-prompt-meta">${metaText}</span>` : ''}
                ${!isMarker ? '<i class="pb-prompt-delete fa-solid fa-trash-can" title="Delete prompt"></i>' : ''}
                ${!isMarker ? '<i class="pb-prompt-expand-icon fa-solid fa-chevron-down"></i>' : ''}
            </div>
            ${!isMarker ? `
            <div class="pb-prompt-card-body">
                <div class="pb-prompt-body-meta">
                    <label>Position: <input type="number" class="pb-injection-pos text_pole" value="${prompt.injection_position ?? 0}" min="0" max="1"></label>
                    <label>Depth: <input type="number" class="pb-injection-depth text_pole" value="${prompt.injection_depth ?? 4}" min="0" max="999"></label>
                    <label>Order: <input type="number" class="pb-injection-order text_pole" value="${prompt.injection_order ?? 100}" min="0" max="999"></label>
                </div>
                <textarea class="pb-prompt-content text_pole">${escapeHtml(prompt.content || '')}</textarea>
            </div>
            ` : ''}
        </div>
    `);

    // Toggle expand/collapse (non-marker only)
    if (!isMarker) {
        $card.find('.pb-prompt-card-header').on('click', function (e) {
            if ($(e.target).is('input, .pb-role-badge, .pb-prompt-delete')) return;
            $card.toggleClass('expanded');
        });
    }

    // Role cycling
    $card.find('.pb-role-badge').on('click', function () {
        if (isMarker) return;
        const current = $(this).data('role');
        const nextIndex = (ROLES.indexOf(current) + 1) % ROLES.length;
        const next = ROLES[nextIndex];
        $(this).data('role', next).attr('data-role', next).text(next);
    });

    // Delete with confirmation
    $card.find('.pb-prompt-delete').on('click', function (e) {
        e.stopPropagation();
        if ($card.hasClass('pb-confirm-delete')) {
            $card.slideUp(200, () => $card.remove());
        } else {
            $card.addClass('pb-confirm-delete');
            toastr.info('Click delete again to confirm removal.');
            setTimeout(() => $card.removeClass('pb-confirm-delete'), 3000);
        }
    });

    // Auto-resize textarea
    $card.find('.pb-prompt-content').on('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    return $card;
}

/**
 * Add a blank prompt entry to the list.
 */
function addBlankPrompt() {
    const newPrompt = {
        identifier: crypto.randomUUID(),
        name: 'New Prompt',
        system_prompt: false,
        role: 'system',
        content: '',
        enabled: true,
        marker: false,
        forbid_overrides: false,
        injection_position: 0,
        injection_depth: 4,
        injection_order: 100,
        injection_trigger: [],
    };

    const $card = createPromptCard(newPrompt);
    $('#pb-prompt-list').append($card);
    $card.addClass('expanded');
    $card.find('.pb-prompt-name').focus();
}

/**
 * Explain the current preset via an LLM call.
 */
async function explainPreset() {
    const preset = assembleDraftFromUI();
    if (!preset) {
        toastr.warning('No preset to explain.');
        return;
    }

    $('#pb-progress').show();
    updateProgress('Generating explanation...');

    try {
        const { generateRaw } = SillyTavern.getContext();
        const presetJson = JSON.stringify(preset, null, 2);
        const { escaped: escapedPresetJson, macroMap: explainMacroMap } = escapeMacros(presetJson);
        const prompt = buildExplanationPrompt(escapedPresetJson);
        const result = await generateRaw({
            prompt,
            systemPrompt: '',
            responseLength: 45000,
        });

        if (!result) {
            throw new Error('Explanation returned empty result.');
        }

        const { DOMPurify } = SillyTavern.libs;
        const cleanHtml = DOMPurify.sanitize(result);
        $('#pb-explanation-content').html(cleanHtml);
        $('#pb-explanation-panel').slideDown(200);
    } catch (err) {
        console.error('[PresetBuilder] Explanation failed:', err);
        toastr.error(`Explanation failed: ${err.message}`);
    } finally {
        $('#pb-progress').hide();
    }
}

/**
 * Assemble the current draft preset from the editable UI state.
 * @returns {object|null}
 */
function assembleDraftFromUI() {
    if (!currentDraft) return null;

    const preset = { ...currentDraft };

    // Read parameters from UI
    const paramFields = [
        'temperature', 'top_p', 'top_k', 'min_p',
        'openai_max_context', 'openai_max_tokens',
        'frequency_penalty', 'presence_penalty',
    ];
    for (const field of paramFields) {
        const val = $(`#pb-param-${field}`).val();
        if (val !== '' && val !== undefined) {
            preset[field] = parseFloat(val);
        }
    }

    // Read prompts from UI
    const prompts = [];
    const promptOrder = [];

    $('#pb-prompt-list .pb-prompt-card').each(function () {
        const $card = $(this);
        const identifier = $card.data('identifier');
        const isMarker = $card.hasClass('is-marker');

        const promptEntry = {
            identifier: String(identifier),
            name: $card.find('.pb-prompt-name').val() || '',
            enabled: $card.find('.pb-prompt-toggle').is(':checked'),
            role: $card.find('.pb-role-badge').data('role') || 'system',
            content: isMarker ? '' : ($card.find('.pb-prompt-content').val() || ''),
            system_prompt: SYSTEM_IDENTIFIERS.has(String(identifier)),
            marker: isMarker,
            forbid_overrides: false,
            injection_trigger: [],
        };

        if (!isMarker) {
            promptEntry.injection_position = parseInt($card.find('.pb-injection-pos').val()) || 0;
            promptEntry.injection_depth = parseInt($card.find('.pb-injection-depth').val()) || 4;
            promptEntry.injection_order = parseInt($card.find('.pb-injection-order').val()) || 100;
        }

        prompts.push(promptEntry);
        promptOrder.push({
            identifier: String(identifier),
            enabled: promptEntry.enabled,
        });
    });

    console.log('[PresetBuilder] assembleDraftFromUI found', prompts.length, 'prompts from', $('#pb-prompt-list .pb-prompt-card').length, 'cards');
    console.log('[PresetBuilder] Prompt names:', prompts.map(p => p.name));

    preset.prompts = prompts;

    // Rebuild prompt_order, preserving system markers from the original
    const existingIdentifiers = new Set(promptOrder.map(p => p.identifier));
    const fullOrder = [];

    if (currentDraft.prompt_order?.[0]?.order) {
        for (const entry of currentDraft.prompt_order[0].order) {
            if (existingIdentifiers.has(entry.identifier)) {
                const uiEntry = promptOrder.find(p => p.identifier === entry.identifier);
                fullOrder.push(uiEntry || entry);
            } else if (SYSTEM_IDENTIFIERS.has(entry.identifier)) {
                fullOrder.push(entry);
            }
        }
        // Add any new prompts that weren't in the original order
        for (const entry of promptOrder) {
            if (!fullOrder.find(e => e.identifier === entry.identifier)) {
                const jbIndex = fullOrder.findIndex(e => e.identifier === 'jailbreak');
                if (jbIndex !== -1) {
                    fullOrder.splice(jbIndex, 0, entry);
                } else {
                    fullOrder.push(entry);
                }
            }
        }
    } else {
        for (const entry of promptOrder) {
            fullOrder.push(entry);
        }
    }

    preset.prompt_order = [{ character_id: 100001, order: fullOrder }];

    // Sync top-level prompt fields
    const mainPrompt = prompts.find(p => p.identifier === 'main');
    const nsfwPrompt = prompts.find(p => p.identifier === 'nsfw');
    const jailbreakPrompt = prompts.find(p => p.identifier === 'jailbreak');

    if (mainPrompt) preset.main_prompt = mainPrompt.content;
    if (nsfwPrompt) preset.nsfw_prompt = nsfwPrompt.content;
    if (jailbreakPrompt) preset.jailbreak_prompt = jailbreakPrompt.content;

    return preset;
}

/**
 * Download the current preset as a JSON file.
 */
function downloadPreset() {
    const preset = assembleDraftFromUI();
    if (!preset) {
        toastr.warning('No preset to download.');
        return;
    }

    const description = $('#pb-description-input').val().trim();
    const filename = generateFilename(description);

    const jsonStr = JSON.stringify(preset, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toastr.success(`Preset downloaded as ${filename}`);
}

/**
 * Generate a filename from the description.
 * @param {string} description
 * @returns {string}
 */
function generateFilename(description) {
    if (!description) return 'preset.json';

    const slug = description
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .substring(0, 50)
        .replace(/-+$/, '');

    return `${slug || 'preset'}-preset.json`;
}

/**
 * Escape HTML special characters for safe insertion.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape a string for use in an HTML attribute.
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
