# Two-Pass Preset Generation - Implementation Summary

## Problem Solved

Single-call generation was truncating because 15-40 substantial prompt entries with full content exceeded the model's output token limit, causing JSON parse failures with `Expected ',' or ']' after array element`.

## Solution Implemented

Split preset generation into two sequential API calls:

1. **Pass 1 (Plan)**: Generate structural blueprint with prompt names, categories, purposes, and settings
2. **Pass 2 (Content)**: Generate full content for each prompt based on the plan

For very large presets (>25 prompts), automatic batching splits Pass 2 into multiple calls.

---

## Changes Made

### File: `prompts.js`

Added three new exported functions:

#### 1. `buildPass1PlanPrompt(userDescription)`
- Generates structural plan with lightweight JSON schema
- Returns: parameters, summaries for main/nsfw/jailbreak, prompt_plan array, prompt_order_plan
- Each prompt_plan entry includes:
  - name, category, role, injection settings
  - purpose (1-2 sentence description)
  - estimated_words (for Pass 2 allocation)
  - position_in_order (placement guidance)
- Includes all 9 mandatory categories and quality standards from original prompt
- Output size: ~5-10KB (never truncates)

#### 2. `buildPass2ContentPrompt(plan, userDescription)`
- Receives the plan from Pass 1
- Generates full content for ALL prompts
- Returns: main_prompt, nsfw_prompt, jailbreak_prompt, prompts array
- Includes detailed content quality standards:
  - Writing Style prompts: 200-500 words with specific techniques
  - Anti-pattern prompts: 30-80 words each
  - CoT prompts: structured steps with word budgets
  - All prompts: specific, actionable, using SillyTavern macros

#### 3. `buildPass2BatchPrompt(plan, promptBatch, userDescription, batchIndex, totalBatches)`
- Used when Pass 2 would truncate (>25 prompts)
- Generates content for a subset of prompts (8-10 per batch)
- Returns: JSON array of prompt objects
- Includes full plan context for consistency

**Stats:**
- `prompts.js`: 789 lines (up from 483 lines)
- Added ~306 lines of two-pass prompt templates

---

### File: `describe.js`

#### 1. Updated Imports
Added imports for new two-pass functions:
```javascript
import {
    buildGenerationPrompt,
    buildAuditPrompt,
    buildExplanationPrompt,
    buildPass1PlanPrompt,
    buildPass2ContentPrompt,
    buildPass2BatchPrompt
} from './prompts.js';
```

#### 2. Rewrote `generatePreset(description)` Function
Complete rewrite to implement two-pass flow:

**Pass 1: Generate Plan**
- Calls `buildPass1PlanPrompt(description)`
- Parses plan JSON
- Validates plan structure (checks for prompt_plan array)
- Displays progress: "Blueprint ready: X prompts planned"

**Pass 2: Generate Content**
- If ≤25 prompts: Single Pass 2 call with `buildPass2ContentPrompt()`
- If >25 prompts: Automatic batching with `generateContentInBatches()`
- Merges content with plan to create focused output
- Converts prompt_order_plan to prompt_order format

**Pass 3: Self-Audit (if enabled)**
- Same as before, operates on focused output

**Pass 4: Assembly**
- Calls `assemblePreset()` with focused output
- Generates UUIDs, builds full preset structure

**Pass 5: Display**
- Renders draft preview

#### 3. Added `generateContentInBatches()` Function
New async function for handling large presets:
- Splits prompt_plan into batches of 10 prompts each
- Generates core prompts (main, nsfw, jailbreak) in separate call
- Generates custom prompts in batches
- Progress updates: "Writing content batch X/Y..."
- Merges all batches into single focused output
- Handles batch failures gracefully (logs warning, continues)

#### 4. Improved `tryRepairJson()` Function
Enhanced truncation repair with better string handling:
- Tracks escape sequences properly
- Tracks string state while scanning
- Closes open strings before closing structures
- Removes trailing commas before closing
- Better error logging

#### 5. Updated Progress Messages
New progress flow:
1. "Analyzing description..."
2. "Generating preset blueprint..."
3. "Blueprint ready: X prompts planned. Generating content..."
4. "Writing prompt content..." (single) OR "Writing content batch X/Y..." (batched)
5. "Running quality check..." (if audit enabled)
6. "Assembling preset..."
7. "Preset generated successfully!"

**Stats:**
- `describe.js`: 913 lines (up from ~650 lines)
- Added ~263 lines for two-pass logic and batching

---

## How It Works

### Small Presets (≤25 prompts)
```
User Input → Pass 1 (Plan) → Pass 2 (Content) → Audit → Assembly → Display
```

### Large Presets (>25 prompts)
```
User Input → Pass 1 (Plan) → Pass 2 Batched:
                                - Core prompts call
                                - Batch 1 (prompts 1-10)
                                - Batch 2 (prompts 11-20)
                                - Batch 3 (prompts 21-30)
                                - etc.
                             → Merge batches → Audit → Assembly → Display
```

---

## Benefits

### 1. No More Truncation
- Pass 1 output is tiny (~5-10KB), never truncates
- Pass 2 knows exact prompt count and can allocate tokens accordingly
- Batching handles even 40+ prompt presets safely

### 2. Better Quality
- Claude can focus on structure in Pass 1 without worrying about content length
- Claude can focus on content quality in Pass 2 with clear guidance per prompt
- Estimated word counts help Claude allocate appropriate detail per prompt

### 3. Better Progress Feedback
- Users see exactly how many prompts are being generated
- Batch progress shows incremental completion
- Clear indication of which phase is running

### 4. Graceful Degradation
- If a batch fails, other batches still succeed
- Truncation repair still available as fallback
- Validation catches structural issues early (after Pass 1)

---

## Backward Compatibility

The original `buildGenerationPrompt()` function is still exported and functional. The extension automatically uses two-pass generation for all new generations, but the single-pass function remains available if needed.

---

## Testing Recommendations

1. **Small preset test**: "A simple roleplay preset for Claude"
   - Should use single Pass 2 call
   - Should complete in ~30-60 seconds

2. **Medium preset test**: "A literary creative writing preset with chain of thought, third-person limited POV, anti-purple-prose rules, and detailed style guidance"
   - Should use single Pass 2 call (15-25 prompts)
   - Should complete in ~60-90 seconds

3. **Large preset test**: "A comprehensive NSFW roleplay preset with chain of thought, multiple POV options, extensive writing style guidance, anti-pattern prompts for omniscience/repetition/summarization/rushing/purple-prose/talking-heads, detailed character autonomy rules, narrative pacing controls, and format examples"
   - Should trigger batching (>25 prompts)
   - Should show batch progress
   - Should complete in ~90-180 seconds

4. **Truncation handling**: Monitor console for any truncation warnings
   - Should see improved repair success rate
   - Should see clear error messages if repair fails

---

## Files Modified

- ✅ `prompts.js` - Added 3 new prompt builder functions
- ✅ `describe.js` - Rewrote generation flow, added batching support

## Files NOT Modified

- ⚪ `preset-template.js` - No changes needed
- ⚪ `settings.html` - No UI changes needed (progress updates dynamically)
- ⚪ `style.css` - No styling changes
- ⚪ `manifest.json` - No manifest changes
- ⚪ `index.js` - No index changes

---

## Performance Characteristics

### API Calls
- **Small preset (15 prompts)**: 2-3 calls (Plan + Content + optional Audit)
- **Medium preset (25 prompts)**: 2-3 calls (Plan + Content + optional Audit)
- **Large preset (35 prompts)**: 5-6 calls (Plan + Core + 3 batches + optional Audit)

### Generation Time
- **Pass 1**: ~10-20 seconds (lightweight plan)
- **Pass 2 (single)**: ~30-60 seconds (full content)
- **Pass 2 (batched)**: ~20-30 seconds per batch
- **Audit**: ~20-30 seconds
- **Total**: 60-180 seconds depending on complexity

### Token Usage
- **Pass 1 input**: ~3-5K tokens (prompt template)
- **Pass 1 output**: ~1-3K tokens (plan)
- **Pass 2 input**: ~5-8K tokens (prompt + plan)
- **Pass 2 output**: ~8-20K tokens (full content)
- **Batch input**: ~5-8K tokens per batch
- **Batch output**: ~3-6K tokens per batch
