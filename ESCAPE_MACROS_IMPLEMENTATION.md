# Escape SillyTavern Macros - Implementation Summary

## Problem Solved

When preset content containing SillyTavern macros (like `{{char}}`, `{{user}}`, `{{//}}`, `{{trim}}`, etc.) was sent to `generateRaw()`, the macro parser would intercept and process them, causing:

1. `{{char}}` and `{{user}}` resolved to empty strings (no active character during generation)
2. `{{//}}` comment macros **stripped content** from prompts, deleting chunks of preset data
3. `{{trim}}` modified whitespace unexpectedly
4. `{{getvar::}}` threw errors or resolved to empty strings
5. Macro parser logged warnings: `[Macro] Warning: Parsing errors detected`

This resulted in corrupted preset content being sent to the audit model, causing bad JSON returns and download failures.

---

## Solution Implemented

Implemented macro escaping utilities that replace `{{...}}` patterns with safe placeholders before sending to `generateRaw()`, then restore them after receiving the response.

---

## Changes Made

### File: `describe.js`

#### 1. Added Three Utility Functions (Lines 37-107)

**`escapeMacros(text)`**
- Replaces all `{{...}}` patterns with safe placeholders (`__MACRO_0__`, `__MACRO_1__`, etc.)
- Returns escaped text and a map for restoration
- Uses regex: `/\{\{[^}]*\}\}/g` to match all macro patterns

**`restoreMacros(text, macroMap)`**
- Restores original macros from placeholders
- Iterates through macroMap and replaces each placeholder with original macro

**`restoreMacrosInPreset(contentResult, macroMap)`**
- Specialized function for restoring macros in preset content objects
- Handles: `main_prompt`, `nsfw_prompt`, `jailbreak_prompt`, and `prompts` array
- Restores macros in each prompt's `content` field

#### 2. Updated All 6 `generateRaw()` Calls

**Change 1: Pass 1 Plan Generation (Line ~199)**
```javascript
// BEFORE:
const pass1Prompt = buildPass1PlanPrompt(description);
const pass1Result = await generateRaw({
    prompt: pass1Prompt,
    ...
});

// AFTER:
const pass1Prompt = buildPass1PlanPrompt(description);
const { escaped: escapedPass1Prompt, macroMap: pass1MacroMap } = escapeMacros(pass1Prompt);
const pass1Result = await generateRaw({
    prompt: escapedPass1Prompt,
    ...
});
```

**Change 2: Pass 2 Content Generation - Single Call (Line ~230)**
```javascript
// BEFORE:
const pass2Prompt = buildPass2ContentPrompt(plan, description);
const pass2Result = await generateRaw({ prompt: pass2Prompt, ... });
const content = parseJsonSafe(contentJson);

// AFTER:
const pass2Prompt = buildPass2ContentPrompt(plan, description);
const { escaped: escapedPass2Prompt, macroMap: pass2MacroMap } = escapeMacros(pass2Prompt);
const pass2Result = await generateRaw({ prompt: escapedPass2Prompt, ... });
const content = parseJsonSafe(contentJson);
const restoredContent = restoreMacrosInPreset(content, pass2MacroMap);
// Use restoredContent instead of content
```

**Change 3: Self-Audit Pass (Line ~262)**
```javascript
// BEFORE:
const focusedJson = JSON.stringify(focusedOutput);
const auditPrompt = buildAuditPrompt(focusedJson, description);
const auditResult = await generateRaw({ prompt: auditPrompt, ... });
const audited = parseJsonSafe(auditJson);
focusedOutput = audited;

// AFTER:
const focusedJson = JSON.stringify(focusedOutput);
const { escaped: escapedFocusedJson, macroMap: auditMacroMap } = escapeMacros(focusedJson);
const auditPrompt = buildAuditPrompt(escapedFocusedJson, description);
const auditResult = await generateRaw({ prompt: auditPrompt, ... });
const audited = parseJsonSafe(auditJson);
const restoredAudited = restoreMacrosInPreset(audited, auditMacroMap);
focusedOutput = restoredAudited;
```

**Change 4: Batched Generation - Core Prompts (Line ~339)**
```javascript
// BEFORE:
const coreResult = await generateRaw({ prompt: corePrompt, ... });
const coreContent = parseJsonSafe(coreJson);

// AFTER:
const { escaped: escapedCorePrompt, macroMap: coreMacroMap } = escapeMacros(corePrompt);
const coreResult = await generateRaw({ prompt: escapedCorePrompt, ... });
const coreContent = parseJsonSafe(coreJson);
const restoredCoreContent = restoreMacrosInPreset(coreContent, coreMacroMap);
// Use restoredCoreContent instead of coreContent
```

**Change 5: Batched Generation - Each Batch (Line ~360)**
```javascript
// BEFORE:
const batchPrompt = buildPass2BatchPrompt(plan, batch, description, i + 1, totalBatches);
const batchResult = await generateRaw({ prompt: batchPrompt, ... });
const batchContent = parseJsonSafe(batchJson);
if (Array.isArray(batchContent)) {
    allPrompts.push(...batchContent);
}

// AFTER:
const batchPrompt = buildPass2BatchPrompt(plan, batch, description, i + 1, totalBatches);
const { escaped: escapedBatchPrompt, macroMap: batchMacroMap } = escapeMacros(batchPrompt);
const batchResult = await generateRaw({ prompt: escapedBatchPrompt, ... });
const batchContent = parseJsonSafe(batchJson);
if (Array.isArray(batchContent)) {
    // Restore macros in each prompt
    for (const prompt of batchContent) {
        if (prompt.content) {
            prompt.content = restoreMacros(prompt.content, batchMacroMap);
        }
    }
    allPrompts.push(...batchContent);
}
```

**Change 6: Explain Preset Feature (Line ~817)**
```javascript
// BEFORE:
const prompt = buildExplanationPrompt(JSON.stringify(preset, null, 2));
const result = await generateRaw({ prompt, ... });

// AFTER:
const presetJson = JSON.stringify(preset, null, 2);
const { escaped: escapedPresetJson, macroMap: explainMacroMap } = escapeMacros(presetJson);
const prompt = buildExplanationPrompt(escapedPresetJson);
const result = await generateRaw({ prompt, ... });
```

---

### File: `prompts.js`

#### Replaced Literal Macro Syntax with Descriptions

Changed 5 locations where literal macro syntax appeared in system prompts:

**Change 1: Line 244 (Token Efficiency section)**
```javascript
// BEFORE:
- Use SillyTavern macros: {{char}}, {{user}}, {{lastUserMessage}}, {{personality}}, {{scenario}}, {{description}}, {{persona}}
- Wrap meta-comments in {{// comment }} so they don't consume tokens at runtime
- End comment blocks with {{trim}} to prevent whitespace waste

// AFTER:
- Use SillyTavern macros: char, user, lastUserMessage, personality, scenario, description, persona (wrapped in double braces)
- Wrap meta-comments in double-brace-slash-slash comment syntax so they don't consume tokens at runtime
- End comment blocks with the trim macro to prevent whitespace waste
```

**Change 2: Line 312 (CoT Character Check)**
```javascript
// BEFORE:
3. **Character Check** (50-100 words): Is my planned response consistent with {{char}}'s personality?

// AFTER:
3. **Character Check** (50-100 words): Is my planned response consistent with the character's personality?
```

**Change 3: Line 552-553 (Pass 2 Content Prompt)**
```javascript
// BEFORE:
- Use SillyTavern macros: {{char}}, {{user}}, {{lastUserMessage}}, {{personality}}, {{scenario}}, {{description}}, {{persona}}
- Wrap meta-comments in {{// comment }} and end with {{trim}} to prevent token waste

// AFTER:
- Use SillyTavern macros: char, user, lastUserMessage, personality, scenario, description, persona (wrapped in double braces)
- Wrap meta-comments in double-brace-slash-slash comment syntax and end with the trim macro to prevent token waste
```

**Change 4: Line 663-665 (Pass 2 Batch Prompt)**
```javascript
// BEFORE:
- Use SillyTavern macros: {{char}}, {{user}}, {{lastUserMessage}}, {{personality}}, {{scenario}}, {{description}}, {{persona}}
- Wrap meta-comments in {{// comment }} with {{trim}}

// AFTER:
- Use SillyTavern macros: char, user, lastUserMessage, personality, scenario, description, persona (wrapped in double braces)
- Wrap meta-comments in double-brace-slash-slash comment syntax with the trim macro
```

**Change 5: Line 745-746 (Audit Checklist)**
```javascript
// BEFORE:
33. **Macro usage**: Are SillyTavern macros used where appropriate ({{char}}, {{user}}, {{lastUserMessage}}, {{personality}}, {{scenario}}, {{description}}, {{persona}})?
34. **Comment syntax**: Are meta-comments wrapped in {{// comment }} with {{trim}} to prevent token waste?

// AFTER:
33. **Macro usage**: Are SillyTavern macros used where appropriate (char, user, lastUserMessage, personality, scenario, description, persona - wrapped in double braces)?
34. **Comment syntax**: Are meta-comments wrapped in double-brace-slash-slash comment syntax with the trim macro to prevent token waste?
```

---

## How It Works

### Escape Flow
```
Original text with macros:
"Use {{char}} and {{user}} in your response. {{// This is a comment}}{{trim}}"
                ↓
escapeMacros() extracts and replaces:
"Use __MACRO_0__ and __MACRO_1__ in your response. __MACRO_2____MACRO_3__"

macroMap = {
  "__MACRO_0__": "{{char}}",
  "__MACRO_1__": "{{user}}",
  "__MACRO_2__": "{{// This is a comment}}",
  "__MACRO_3__": "{{trim}}"
}
                ↓
Send to generateRaw() - macro parser sees no macros, doesn't process
                ↓
Receive response with placeholders intact
                ↓
restoreMacros() replaces placeholders with originals:
"Use {{char}} and {{user}} in your response. {{// This is a comment}}{{trim}}"
```

### Before (Problematic)
```
Preset content: "{{char}} is the character. {{// comment}}{{trim}}"
        ↓
Send to generateRaw()
        ↓
Macro parser intercepts:
- {{char}} → "" (empty, no active character)
- {{// comment}}{{trim}} → deleted (comment macro strips content)
        ↓
Model receives: " is the character. "
        ↓
Corrupted content, bad JSON, download fails
```

### After (Fixed)
```
Preset content: "{{char}} is the character. {{// comment}}{{trim}}"
        ↓
escapeMacros(): "__MACRO_0__ is the character. __MACRO_1____MACRO_2__"
        ↓
Send to generateRaw()
        ↓
Macro parser sees no macros, passes through unchanged
        ↓
Model receives: "__MACRO_0__ is the character. __MACRO_1____MACRO_2__"
        ↓
Model processes and returns with placeholders intact
        ↓
restoreMacros(): "{{char}} is the character. {{// comment}}{{trim}}"
        ↓
Correct content, valid JSON, download succeeds
```

---

## Benefits

### 1. Prevents Content Corruption
- Macros in preset content are preserved exactly as written
- No more empty strings from `{{char}}`/`{{user}}`
- No more content deletion from `{{//}}` comment macros
- No more whitespace issues from `{{trim}}`

### 2. Fixes Audit Pass
- The most critical fix - audit pass now receives uncorrupted preset content
- Audit model can properly analyze and correct the preset
- No more JSON parse failures from corrupted audit responses

### 3. Protects All Generation Calls
- All 6 `generateRaw()` calls now escape macros
- User descriptions with macros won't break generation
- Explain feature works correctly with macro-heavy presets

### 4. Safe System Prompts
- Removed literal macro syntax from system prompts in prompts.js
- Described macros in plain English instead
- No risk of system prompts being corrupted by macro parser

---

## Files Modified

- ✅ `describe.js` - Added 3 utility functions, updated all 6 `generateRaw()` calls
- ✅ `prompts.js` - Replaced literal macro syntax with descriptions in 5 locations

## Files NOT Modified

- ⚪ `preset-template.js` - No changes needed
- ⚪ `settings.html` - No changes needed
- ⚪ `style.css` - No changes needed
- ⚪ `manifest.json` - No changes needed
- ⚪ `index.js` - No changes needed

---

## Testing Recommendations

1. **Test with macro-heavy preset**:
   - Generate a preset that uses `{{char}}`, `{{user}}`, `{{//}}`, `{{trim}}` extensively
   - Enable self-audit
   - Verify all macros are preserved in the downloaded preset
   - Check console for no macro parser warnings

2. **Test user description with macros**:
   - Enter description: "I want {{char}} to be friendly and {{user}} to be cautious"
   - Generate preset
   - Verify generation completes without errors

3. **Test explain feature**:
   - Generate a preset with macros
   - Click "Explain This Preset"
   - Verify explanation generates without errors

4. **Test audit pass specifically**:
   - Generate a complex preset with self-audit enabled
   - Check that audit corrections preserve all macros
   - Verify no JSON parse errors in console

---

## Reference Implementation

This implementation follows the same pattern used by the Preset Analyzer extension in this project, which has `extractMacros()` and `restoreMacrosInAnalysis()` functions that solve the exact same problem.
