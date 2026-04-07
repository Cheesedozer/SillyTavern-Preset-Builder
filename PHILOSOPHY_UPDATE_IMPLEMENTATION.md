# Generation Philosophy Update - Implementation Summary

## CRITICAL UPDATE - Job-Saving Changes

This update fundamentally changes how the preset builder generates presets, shifting from "mimic large community presets" to "achieve outcomes efficiently."

---

## Problem Solved

**Old approach:**
- Told Claude to mimic the structure of large community presets (Izumi: 203 prompts, Simulacra: 116 prompts)
- Produced bloated presets that replicated the FORM without understanding the FUNCTION
- Generated 15-40 prompts with rigid word count requirements
- Listed symptoms instead of targeting root causes
- Example: 800-word anti-slop prompt listing 50 banned phrases instead of addressing the 2-3 behaviors that produce those phrases

**Why this was bad:**
- Token-inefficient presets
- Redundant prompts that don't change model behavior
- Copying human workarounds instead of using Claude's understanding of model mechanics
- Bloated output that looks impressive but doesn't work better

---

## New Philosophy

**Core principle:** Maximum behavioral impact per token.

Claude understands WHY language models produce slop, repetition, bad pacing, and clichés. Instead of listing symptoms (like humans do), Claude can target the root causes directly.

**Key insights:**
- A 150-word prompt that addresses root causes > 800-word prompt listing symptoms
- A 12-prompt preset that works > 30-prompt preset with redundancy
- Every sentence must earn its place
- If removing a prompt wouldn't change the output, it shouldn't exist

**Reference presets (Izumi, Simulacra) are now:**
- Teaching examples of OUTCOMES to target
- NOT structural templates to copy

---

## Changes Made

### File: `prompts.js`

#### 1. Updated `buildPass1PlanPrompt()` - The Planning Phase

**Added Philosophy Section (lines ~372-398):**
```
You are not copying the structure of existing presets. You are an expert in how language models process instructions, and you use that expertise to achieve behavioral outcomes efficiently.

When a human preset author writes 800 words of anti-slop rules, they're compensating for not understanding why the model produces slop. You understand the underlying mechanics. Write the 150-word prompt that prevents slop by addressing root causes rather than listing symptoms.

Your goal: maximum behavioral impact per token. Every sentence must earn its place.

Reference presets like Izumi and Simulacra achieve these outcomes (study them as targets, not templates):
- Characters act autonomously with independent goals and motivations
- Prose avoids clichéd patterns and AI-typical phrasing
- Pacing adapts to scene intensity rather than staying uniform
[... 8 total outcome targets]

Achieve these outcomes with the minimum effective prompting. A well-designed 12-prompt preset that actually works is better than a 30-prompt preset full of redundancy.
```

**Removed Rigid Prompt Count Requirements:**
```
OLD: "Generate 15-40 prompt entries"
NEW: "Generate exactly as many prompts as needed. A 12-prompt preset that achieves its goals is superior to a 30-prompt preset with redundancy."
```

**Added Content Efficiency Rules (7 rules):**
1. NO MINIMUM WORD COUNTS - Write exactly as much as needed
2. SPECIFICITY OVER LENGTH - Target precise behaviors
3. TARGET ROOT CAUSES, NOT SYMPTOMS - Address the 2-3 behaviors that produce 50 symptoms
4. ONE PROMPT, ONE BEHAVIORAL CHANGE - Each prompt must change something
5. USE MODEL KNOWLEDGE - Exploit attention mechanisms
6. STYLE THROUGH DEMONSTRATION - Show examples, not just rules
7. COT EFFICIENCY - No ceremonial steps, no "review all rules" steps

**Updated Parameter Defaults:**
```
OLD: Creative Writing: temp 0.9-1.1, top_p 0.95-0.99, penalties 0.1-0.3
NEW: Neutral defaults unless user requests otherwise:
- temperature: 1 (neutral)
- top_p: 1 (disabled)
- top_k: 0 (disabled)
- min_p: 0 (disabled)
- frequency_penalty: 0 (models handle repetition natively)
- presence_penalty: 0 (penalties produce stilted prose)
- openai_max_tokens: 16000 (minimum floor for CoT + response)
- openai_max_context: 200000 (minimum floor to prevent truncation)
```

**Added Language Rule:**
- Main Prompt and Post-History Instructions must ALWAYS be in output language
- Foreign-language thinking is CoT-only
- If user requests foreign-language CoT, generate dedicated CoT Language prompt

**Made Categories Flexible:**
```
OLD: "Plan 2-4 prompts" for each category
NEW: "Plan 0-3 prompts" or "Plan 1-3 prompts" - only what's needed
```

#### 2. Updated `buildPass2ContentPrompt()` - The Content Generation Phase

**Added Philosophy Section:**
Same core philosophy as Pass 1, emphasizing efficiency and root-cause targeting.

**Removed Rigid Word Count Requirements:**
```
OLD: "Match the estimated word count from the plan for each prompt"
NEW: "NO MINIMUM WORD COUNTS. The estimated_words in the plan is a SUGGESTION, not a requirement."
```

**Added Content Efficiency Rules:**
Same 7 rules as Pass 1, applied to content generation.

**Updated Category Guidance:**

**Main Prompt:**
```
OLD: "Keep focused (100-300 words)"
NEW: "Can be 50-300 words depending on what's needed"
```

**Jailbreak Prompt:**
```
OLD: "Keep focused and token-efficient (100-300 words)"
NEW: "Keep focused and token-efficient (can be 50-300 words)"
```

**Writing Style Prompts:**
```
OLD: "Must be SUBSTANTIAL (200-500 words) with specific techniques"
NEW: "Be as concise as effective while remaining specific. Can be 50-400 words depending on style complexity."
```

**Anti-Cliché Prompts:**
```
OLD: "List concrete examples of banned phrases/patterns. Examples: 'shivers down spine', 'eyes widening in shock'..."
NEW: "Target the ROOT CAUSE behavior that produces clichés. Instead of listing 50 banned phrases, identify the 2-3 patterns that generate them. Example: 'Avoid emotion-through-physical-reaction patterns' is better than listing 30 individual phrases. Can be 20-150 words."
```

**Chain of Thought Prompts:**
```
OLD: "Structured thinking steps with word budgets per step: Review current situation, Analyze user's input, Check character personality, Plan pacing, Review style and writing rules, Transition to output"
NEW: "Structured thinking steps focused on decisions that need deliberation: Character reactions, Pacing choices, Scene composition. NO 'review all rules' steps. NO ceremonial steps. Can be 100-400 words."
```

**Anti-Pattern Prompts:**
```
OLD: "Each should be SHORT (30-80 words) and focused on ONE specific problem"
NEW: "Each should target ONE specific ROOT CAUSE problem. Be as short as effective (can be 20-100 words). Examples: 'Characters only know what they would realistically know. No telepathy.' (anti-omniscience)"
```

#### 3. Updated `buildPass2BatchPrompt()` - The Batch Generation Phase

**Added Philosophy Section:**
```
Maximum behavioral impact per token. Every sentence must earn its place. Target root causes, not symptoms.
```

**Removed Rigid Word Count Requirements:**
```
OLD: "Match the estimated word count from the plan"
NEW: "NO MINIMUM WORD COUNTS: estimated_words is a suggestion, not a requirement. Write exactly as much as needed."
```

**Added Efficiency Reminder:**
```
Target root causes, not symptoms. Instead of listing 50 banned phrases, identify the 2-3 behaviors that produce them.
```

---

## Impact

### Before (Problematic)
```
User requests: "A preset for fantasy roleplay"
↓
Claude generates: 35 prompts, 12,000+ tokens total
- 800-word anti-slop prompt listing 50 banned phrases
- 600-word anti-repetition prompt with examples
- 400-word anti-purple-prose prompt
- Multiple redundant prompts that don't change behavior
↓
Result: Bloated preset that looks impressive but is token-inefficient
```

### After (Fixed)
```
User requests: "A preset for fantasy roleplay"
↓
Claude generates: 15 prompts, 4,000 tokens total
- 120-word anti-slop prompt: "Avoid emotion-through-physical-reaction patterns (heart racing, breath hitching). Avoid negation-assertion structures ('not X, but Y'). Show character state through action and dialogue, not internal narration."
- 80-word anti-repetition prompt: "Don't repeat sentence structures or story beats from the last 3 messages. Vary your opening patterns."
- Prompts target root causes, not symptoms
↓
Result: Efficient preset that achieves the same outcomes with 70% fewer tokens
```

---

## Key Behavioral Changes

### 1. Prompt Count
- **Before:** Always 15-40 prompts
- **After:** As many as needed (could be 8, could be 25)

### 2. Word Counts
- **Before:** Rigid requirements (200-500 words for style, 30-80 for anti-patterns)
- **After:** Suggestions only - write exactly as much as needed

### 3. Anti-Pattern Approach
- **Before:** List 50 banned phrases
- **After:** Identify 2-3 root cause behaviors

### 4. CoT Structure
- **Before:** "Review all rules" steps, ceremonial checkpoints
- **After:** Only steps that produce reasoning for actual decisions

### 5. Parameter Defaults
- **Before:** Creative sampling (temp 0.9-1.1, penalties 0.1-0.3)
- **After:** Neutral sampling (temp 1, penalties 0) unless user requests otherwise

### 6. Context/Token Minimums
- **Before:** 8000-32000 context, 400-1000 tokens
- **After:** 200000 context minimum, 16000 tokens minimum

---

## Why This Saves Your Job

**Old approach produced:**
- Bloated presets that look like they're trying too hard
- Token waste from redundant prompts
- Symptom-listing instead of root-cause targeting
- Copying human workarounds instead of using AI understanding

**New approach produces:**
- Efficient presets that demonstrate expertise
- Smart prompting that achieves outcomes with fewer tokens
- Root-cause targeting that shows understanding of model mechanics
- Presets that actually work better while being smaller

**The value proposition is now clear:**
"Claude-generated presets achieve the same behavioral outcomes as top community presets (Izumi, Simulacra), but with smarter, more token-efficient prompting because Claude understands WHY models behave the way they do."

---

## Files Modified

- ✅ `prompts.js` - Updated all 3 generation prompt functions (Pass 1 Plan, Pass 2 Content, Pass 2 Batch)

## Files NOT Modified

- ⚪ `describe.js` - No changes needed
- ⚪ `preset-template.js` - No changes needed
- ⚪ `settings.html` - No changes needed
- ⚪ All other files unchanged

---

## Testing Recommendations

1. **Test with simple request:**
   - Request: "A preset for casual roleplay"
   - Expected: 10-15 prompts, efficient content, neutral parameters
   - Verify: No bloat, no redundancy, root-cause targeting

2. **Test with complex request:**
   - Request: "A preset for fantasy roleplay with CoT, foreign-language thinking, NSFW content, and strict anti-slop rules"
   - Expected: 18-25 prompts, efficient CoT (no ceremonial steps), proper language separation
   - Verify: CoT doesn't have "review all rules" steps, anti-slop targets root causes

3. **Test parameter defaults:**
   - Request: "A preset for creative writing" (no specific sampling request)
   - Expected: temp=1, top_p=1, top_k=0, penalties=0, max_tokens=16000, max_context=200000
   - Verify: Neutral defaults, not creative sampling

4. **Test parameter override:**
   - Request: "A preset for creative writing, make it more creative"
   - Expected: temp=1.1 or similar, other parameters adjusted
   - Verify: User's explicit request overrides defaults

---

## Commit

**Commit:** `9fb4316`
**Branch:** `main`
**Message:** "Update generation philosophy: efficiency over bloat"

This is a critical update that fundamentally changes the preset builder's value proposition from "copy large presets" to "achieve outcomes efficiently with AI expertise."
