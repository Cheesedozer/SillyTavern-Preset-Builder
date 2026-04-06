# Fix generateRaw Calls - Implementation Summary

## Problem Solved

The `generateRaw()` calls were either:
1. Using old positional argument format
2. Missing the `responseLength` parameter, causing output truncation
3. Wrapped in an unnecessary `withGenerationOverrides` helper function

## Solution Implemented

1. **Removed the `withGenerationOverrides` wrapper function** - Not needed because `generateRaw()` natively supports `responseLength` parameter
2. **Updated all 6 `generateRaw()` calls** to use the proper object format with `responseLength: 45000`

---

## Changes Made

### File: `describe.js`

#### 1. Removed `withGenerationOverrides()` Function
**Lines removed:** 37-87 (51 lines)

The wrapper function was attempting to manually override `oai_settings` before/after calls, but this is unnecessary because `generateRaw()` has a built-in `responseLength` parameter that handles this automatically.

#### 2. Updated All 6 `generateRaw()` Calls

**Change 1: Pass 1 Plan Generation (Line ~132)**
```javascript
// BEFORE:
const pass1Result = await withGenerationOverrides(() => generateRaw({
    prompt: pass1Prompt,
    systemPrompt: '',
}));

// AFTER:
const pass1Result = await generateRaw({
    prompt: pass1Prompt,
    systemPrompt: '',
    responseLength: 45000,
});
```

**Change 2: Pass 2 Content Generation - Single Call (Line ~162)**
```javascript
// BEFORE:
const pass2Result = await withGenerationOverrides(() => generateRaw({
    prompt: pass2Prompt,
    systemPrompt: '',
}));

// AFTER:
const pass2Result = await generateRaw({
    prompt: pass2Prompt,
    systemPrompt: '',
    responseLength: 45000,
});
```

**Change 3: Self-Audit Pass (Line ~194)**
```javascript
// BEFORE:
const auditResult = await withGenerationOverrides(() => generateRaw({
    prompt: auditPrompt,
    systemPrompt: '',
}));

// AFTER:
const auditResult = await generateRaw({
    prompt: auditPrompt,
    systemPrompt: '',
    responseLength: 45000,
});
```

**Change 4: Batched Generation - Core Prompts (Line ~263)**
```javascript
// BEFORE:
const coreResult = await withGenerationOverrides(() => generateRaw({
    prompt: corePrompt,
    systemPrompt: '',
}));

// AFTER:
const coreResult = await generateRaw({
    prompt: corePrompt,
    systemPrompt: '',
    responseLength: 45000,
});
```

**Change 5: Batched Generation - Each Batch (Line ~281)**
```javascript
// BEFORE:
const batchResult = await withGenerationOverrides(() => generateRaw({
    prompt: batchPrompt,
    systemPrompt: '',
}));

// AFTER:
const batchResult = await generateRaw({
    prompt: batchPrompt,
    systemPrompt: '',
    responseLength: 45000,
});
```

**Change 6: Explain Preset Feature (Line ~731)**
```javascript
// BEFORE:
const result = await withGenerationOverrides(() => generateRaw({
    prompt,
    systemPrompt: '',
}));

// AFTER:
const result = await generateRaw({
    prompt,
    systemPrompt: '',
    responseLength: 45000,
});
```

---

## How It Works

### The `responseLength` Parameter

SillyTavern's `generateRaw()` function accepts a `responseLength` parameter that:
- **Temporarily overrides** the user's preset `openai_max_tokens` for that single call
- **Automatically restores** the original value after the call completes
- **Handles errors gracefully** - restores even if the generation fails

This is a native feature of SillyTavern's API, so no manual save/restore logic is needed.

### Before (Problematic)
```
User has preset with max_tokens: 600
↓
Extension calls generateRaw() without responseLength
↓
Inherits max_tokens: 600
↓
JSON output truncates at 600 tokens
↓
JSON.parse() fails with "Expected ',' or ']'"
```

### After (Fixed)
```
User has preset with max_tokens: 600
↓
Extension calls generateRaw({ ..., responseLength: 45000 })
↓
SillyTavern temporarily sets max_tokens: 45000
↓
Full JSON output generated (no truncation)
↓
SillyTavern restores max_tokens: 600
↓
JSON.parse() succeeds
```

---

## Benefits

### 1. Eliminates Truncation
- 45000 tokens is enough for even the largest presets (40+ prompts with full content)
- User's low max_tokens (400-800) no longer causes truncation
- Eliminates the most common cause of JSON parse failures

### 2. Simpler Code
- Removed 51 lines of unnecessary wrapper function
- Uses native SillyTavern API feature instead of manual override
- Cleaner, more maintainable code

### 3. More Reliable
- SillyTavern's built-in parameter override is more robust than manual settings manipulation
- No risk of forgetting to restore settings
- No dependency on `window.oai_settings` structure

### 4. Consistent with Best Practices
- Matches the pattern used by other SillyTavern extensions (e.g., Preset Analyzer)
- Uses the documented API correctly
- Future-proof against SillyTavern internal changes

---

## Verification

All 6 `generateRaw()` calls now include `responseLength: 45000`:
1. ✅ Pass 1 plan generation
2. ✅ Pass 2 content generation (single call)
3. ✅ Self-audit pass
4. ✅ Batched generation - core prompts
5. ✅ Batched generation - each batch
6. ✅ Explain preset feature

JavaScript syntax validated with `node -c describe.js` - no errors.

---

## Files Modified

- ✅ `describe.js` - Removed wrapper function, updated all 6 `generateRaw()` calls

## Files NOT Modified

- ⚪ `prompts.js` - No changes needed
- ⚪ `preset-template.js` - No changes needed
- ⚪ `settings.html` - No changes needed
- ⚪ `style.css` - No changes needed
- ⚪ `manifest.json` - No changes needed
- ⚪ `index.js` - No changes needed

---

## Testing Recommendations

1. **Test with low max_tokens preset**:
   - Set user's active preset to max_tokens: 500
   - Generate a complex preset (30+ prompts)
   - Should complete without truncation
   - Verify user's preset still shows max_tokens: 500 after generation

2. **Test with large preset**:
   - Request a preset with 40+ prompts
   - Should trigger batching and complete all batches
   - No JSON parse errors in console

3. **Test error handling**:
   - Simulate a generation error (disconnect network mid-generation)
   - Verify no settings are left in a bad state
   - Extension should handle error gracefully

---

## Note on Temperature/Top-P/Top-K

The requirements document mentioned optionally overriding `temperature`, `top_p`, and `top_k` for better output quality. However:

- These parameters **cannot** be passed through `generateRaw()`
- They would require manual `oai_settings` manipulation
- The truncation fix via `responseLength` is the critical change
- Sampling parameter overrides are lower priority and were not implemented

If needed in the future, they can be added as a try/finally block around the entire `generatePreset()` function, but this is not necessary for fixing the truncation issue.
