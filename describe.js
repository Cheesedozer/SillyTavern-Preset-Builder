/**
 * Describe tab logic for the Preset Builder extension.
 * Handles generation, draft preview, editing, explanation, and download.
 */

import { buildGenerationPrompt, buildAuditPrompt, buildExplanationPrompt } from './prompts.js';
import { getSettings, saveSettings } from './index.js';

/** @type {object|null} The current draft preset data */
let currentDraft = null;

/** @type {boolean} Whether a generation is in progress */
let isGenerating = false;

const ROLES = ['system', 'user', 'assistant'];

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
 * Main generation flow: generate preset from description.
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

        // Step 1: Generate preset
        updateProgress('Generating prompt entries and parameters...');
        const generationPrompt = buildGenerationPrompt(description);
        const rawResult = await generateRaw({
            prompt: generationPrompt,
            systemPrompt: '',
        });

        if (!rawResult) {
            throw new Error('Generation returned empty result. Make sure you have an LLM API configured.');
        }

        let presetJson = extractJson(rawResult);
        let preset = JSON.parse(presetJson);

        // Step 2: Self-audit (if enabled)
        if (settings.selfAuditEnabled) {
            updateProgress('Running quality check...');
            const auditPrompt = buildAuditPrompt(presetJson, description);
            const auditResult = await generateRaw({
                prompt: auditPrompt,
                systemPrompt: '',
            });

            if (auditResult) {
                try {
                    const auditJson = extractJson(auditResult);
                    const auditedPreset = JSON.parse(auditJson);
                    preset = auditedPreset;
                    presetJson = auditJson;
                } catch {
                    console.warn('[PresetBuilder] Audit response was not valid JSON, using original.');
                }
            }
        }

        // Step 3: Display draft
        updateProgress('Building preview...');
        currentDraft = preset;
        renderDraftPreview(preset);
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
 * Render the full draft preview from a preset object.
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
        const prompt = buildExplanationPrompt(JSON.stringify(preset, null, 2));
        const result = await generateRaw({
            prompt,
            systemPrompt: '',
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

    // Collect system markers that exist in the original prompt_order but aren't prompt cards
    const systemMarkers = [
        'charDescription', 'charPersonality', 'scenario',
        'personaDescription', 'worldInfoBefore', 'enhanceDefinitions',
        'worldInfoAfter',
    ];

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
            system_prompt: ['main', 'nsfw', 'jailbreak', 'dialogueExamples', 'chatHistory'].includes(String(identifier)),
            marker: isMarker,
            forbid_overrides: false,
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

    preset.prompts = prompts;

    // Rebuild prompt_order, preserving system markers
    const existingIdentifiers = new Set(promptOrder.map(p => p.identifier));
    const fullOrder = [];

    // Use the original prompt_order as a guide if it exists
    if (currentDraft.prompt_order && currentDraft.prompt_order[0] && currentDraft.prompt_order[0].order) {
        for (const entry of currentDraft.prompt_order[0].order) {
            if (existingIdentifiers.has(entry.identifier)) {
                const uiEntry = promptOrder.find(p => p.identifier === entry.identifier);
                fullOrder.push(uiEntry || entry);
            } else if (systemMarkers.includes(entry.identifier)) {
                fullOrder.push(entry);
            }
        }
        // Add any new prompts that weren't in the original order
        for (const entry of promptOrder) {
            if (!fullOrder.find(e => e.identifier === entry.identifier)) {
                // Insert before jailbreak if possible
                const jbIndex = fullOrder.findIndex(e => e.identifier === 'jailbreak');
                if (jbIndex !== -1) {
                    fullOrder.splice(jbIndex, 0, entry);
                } else {
                    fullOrder.push(entry);
                }
            }
        }
    } else {
        // Fallback: construct a basic order
        for (const entry of promptOrder) {
            fullOrder.push(entry);
        }
        for (const marker of systemMarkers) {
            if (!fullOrder.find(e => e.identifier === marker)) {
                fullOrder.push({ identifier: marker, enabled: true });
            }
        }
    }

    preset.prompt_order = [{ character_id: 100000, order: fullOrder }];

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

    // Generate filename from description
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
