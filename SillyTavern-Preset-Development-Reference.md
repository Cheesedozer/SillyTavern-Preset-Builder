# SillyTavern Preset Development Reference

> **Purpose:** This document is a comprehensive reference for creating, editing, and managing SillyTavern presets. It covers all preset types — sampler/parameter presets, Chat Completion presets (with Prompt Manager), context templates, instruct templates, system prompts, and master import/export bundles. Use this as your primary reference when building SillyTavern presets from scratch or customizing existing ones.
>
> **Last Updated:** April 2026 — Based on SillyTavern 1.13.x / 1.14.x documentation, DeepWiki source analysis, and community preset repositories.

---

## Table of Contents

1. [Overview](#overview)
2. [Preset Types and Taxonomy](#preset-types-and-taxonomy)
3. [File Locations and Data Paths](#file-locations-and-data-paths)
4. [Text Completion Presets (Sampler Presets)](#text-completion-presets-sampler-presets)
5. [Sampler Parameters Reference](#sampler-parameters-reference)
6. [Sampler Ordering](#sampler-ordering)
7. [Chat Completion Presets](#chat-completion-presets)
8. [Prompt Manager System](#prompt-manager-system)
9. [Context Templates](#context-templates)
10. [Instruct Templates](#instruct-templates)
11. [System Prompts](#system-prompts)
12. [Reasoning Templates](#reasoning-templates)
13. [Prompt Layering and Construction](#prompt-layering-and-construction)
14. [Master Import / Export](#master-import--export)
15. [PresetManager API (for Extension Developers)](#presetmanager-api-for-extension-developers)
16. [Preset Extension Data](#preset-extension-data)
17. [Auto-Selection System](#auto-selection-system)
18. [Macros in Presets](#macros-in-presets)
19. [Backend-Specific Considerations](#backend-specific-considerations)
20. [Sampler Configuration Recipes](#sampler-configuration-recipes)
21. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
22. [Reference Links](#reference-links)

---

## Overview

SillyTavern uses a preset system to manage collections of generation parameters, prompt configurations, and formatting templates. Presets allow users to save, share, and switch between different configurations without manually re-entering settings every time.

There are two fundamentally different paradigms in SillyTavern, and presets work differently in each:

- **Text Completion APIs** (KoboldAI, llama.cpp, Ooba/TextGenWebUI, TabbyAPI, Aphrodite, Ollama, etc.) — These use the **Advanced Formatting** panel for prompt construction (context templates, instruct templates, story string) and **sampler preset files** for generation parameters.
- **Chat Completion APIs** (OpenAI, Claude, Gemini, Mistral API, OpenRouter in chat mode, etc.) — These use the **Prompt Manager** system for prompt construction and store both prompts and parameters together in a single preset file.

**Key principle:** A "preset" in the SillyTavern community can refer to several different things depending on context — a sampler parameter set, a Prompt Manager configuration, a context template, an instruct template, a system prompt, or a "master file" bundling all of the above. This document covers all of them.

---

## Preset Types and Taxonomy

SillyTavern manages eight distinct preset categories internally via the `PresetManager` class:

| Preset Type | Storage Directory | API Scope | Contains |
|---|---|---|---|
| **Text Completion** | `TextGen Settings/` | Text Generation backends | Sampler parameters (temperature, top_p, etc.) |
| **KoboldAI** | `KoboldAI Settings/` | KoboldAI, Horde | KoboldAI-specific sampler parameters |
| **NovelAI** | `NovelAI Settings/` | NovelAI | NovelAI-specific parameters; v3 auto-conversion |
| **OpenAI (Chat Completion)** | `OpenAI Settings/` | Chat Completion APIs | Prompts, prompt_order, and parameters combined |
| **Context Template** | `context/` | All APIs | Story string template (how character data is assembled) |
| **Instruct Template** | `instruct/` | All APIs | Chat template wrapping (system/user/assistant formatting) |
| **System Prompt** | `sysprompt/` | All APIs | The main system-level instruction text |
| **Reasoning Template** | `reasoning/` | All APIs | Model reasoning/chain-of-thought display settings |

**Source:** `public/scripts/preset-manager.js` lines 44–596

---

## File Locations and Data Paths

All preset files are stored as JSON within the user data directory. The default user data root is:

```
SillyTavern/data/<user-handle>/
```

Specific subdirectories for each preset type:

```
data/<user-handle>/
├── TextGen Settings/           # Text Completion sampler presets (.json)
├── KoboldAI Settings/          # KoboldAI sampler presets (.json)
├── NovelAI Settings/           # NovelAI sampler presets (.json)
├── OpenAI Settings/            # Chat Completion presets (.json)
│                                 (includes prompts + prompt_order + parameters)
├── context/                    # Context template presets (.json)
├── instruct/                   # Instruct template presets (.json)
├── sysprompt/                  # System prompt presets (.json)
└── reasoning/                  # Reasoning template presets (.json)
```

### Manual Installation

To install a preset manually, copy the `.json` file into the appropriate subdirectory above, then restart SillyTavern or reload the UI. The preset will appear in its respective dropdown.

### UI Installation

- **Text Completion presets:** Go to the "Sliders" tab (AI Response Configuration) → use the preset dropdown → Import
- **Chat Completion presets:** Go to the "AI Response Configuration" panel → preset dropdown → Import
- **Context/Instruct templates:** Go to the "Capital A" tab (AI Response Formatting / Advanced Formatting) → use the appropriate dropdown → Import
- **System prompts:** Same "Capital A" tab → System Prompt section → Import
- **Master files:** "Capital A" tab → Import button (auto-detects and distributes sections)

---

## Text Completion Presets (Sampler Presets)

Text Completion presets are the simplest preset type. They contain only sampler/generation parameters as a flat JSON object. These control how the language model selects tokens during generation.

### Minimal Example

```json
{
    "temp": 1.0,
    "top_p": 0.9,
    "top_k": 0,
    "min_p": 0.05,
    "rep_pen": 1.1,
    "rep_pen_range": 2048,
    "max_tokens_second": 0,
    "max_length": 512
}
```

### Full Example with All Common Fields

```json
{
    "temp": 1.0,
    "temperature_last": true,
    "top_p": 1.0,
    "top_k": 0,
    "top_a": 0,
    "min_p": 0.05,
    "typical_p": 1.0,
    "tfs": 1.0,
    "rep_pen": 1.1,
    "rep_pen_range": 2048,
    "rep_pen_decay": 0,
    "rep_pen_slope": 0.7,
    "no_repeat_ngram_size": 0,
    "frequency_penalty": 0,
    "presence_penalty": 0,
    "penalty_alpha": 0,
    "mirostat_mode": 0,
    "mirostat_tau": 5,
    "mirostat_eta": 0.1,
    "dynatemp": false,
    "min_temp": 0.75,
    "max_temp": 1.25,
    "dynatemp_exponent": 1.0,
    "smoothing_factor": 0,
    "smoothing_curve": 1,
    "dry_multiplier": 0,
    "dry_base": 1.75,
    "dry_allowed_length": 2,
    "dry_penalty_last_n": 0,
    "dry_sequence_breakers": "[\"\\n\", \":\", \"\\\"\", \"*\"]",
    "xtc_threshold": 0.1,
    "xtc_probability": 0,
    "max_length": 512,
    "seed": -1,
    "epsilon_cutoff": 0,
    "eta_cutoff": 0,
    "encoder_rep_pen": 1,
    "do_sample": true,
    "add_bos_token": true,
    "skip_special_tokens": true,
    "banned_tokens": "",
    "logit_bias": [],
    "custom_model": "",
    "sampler_priority": [],
    "samplers_to_skip": []
}
```

**Note:** Not all fields are used by all backends. SillyTavern dynamically shows/hides sampler controls based on which backend is currently selected. Including extra fields in a preset JSON is harmless — unused fields are simply ignored.

---

## Sampler Parameters Reference

These parameters are universal across supported backends, though not every backend supports every parameter.

### Core Samplers

| Parameter | JSON Key | Range | Default | Description |
|---|---|---|---|---|
| Temperature | `temp` | 0.0–5.0 | 0.7–1.0 | Controls randomness. Higher = more creative, lower = more deterministic. |
| Top P (Nucleus) | `top_p` | 0.0–1.0 | 0.9–1.0 | Keeps tokens whose cumulative probability exceeds this threshold. 1.0 = disabled. |
| Top K | `top_k` | 0–200+ | 0 | Limits selection to K most likely tokens. 0 = disabled. |
| Min P | `min_p` | 0.0–1.0 | 0.0–0.1 | Filters tokens below this fraction of the top token's probability. 0 = disabled. |
| Top A | `top_a` | 0.0–1.0 | 0.0 | Removes tokens below an adaptive threshold. 0 = disabled. |
| Typical P | `typical_p` | 0.0–1.0 | 1.0 | Locally typical sampling. 1.0 = disabled. |
| Tail Free Sampling | `tfs` | 0.0–1.0 | 1.0 | Removes low-probability tail. 1.0 = disabled. |

### Repetition Control

| Parameter | JSON Key | Range | Default | Description |
|---|---|---|---|---|
| Repetition Penalty | `rep_pen` | 1.0–1.5 | 1.0–1.15 | Penalizes repeated tokens. 1.0 = disabled. |
| Rep. Pen. Range | `rep_pen_range` | 0–4096+ | 0–2048 | How many tokens back to check. 0 = entire context. |
| Frequency Penalty | `frequency_penalty` | 0.0–2.0 | 0.0 | OpenAI-style: penalty proportional to frequency. |
| Presence Penalty | `presence_penalty` | 0.0–2.0 | 0.0 | OpenAI-style: flat penalty for any prior occurrence. |
| No Repeat N-gram | `no_repeat_ngram_size` | 0–20 | 0 | Prevents repeating N-grams of this size. 0 = disabled. |

### Advanced Samplers

| Parameter | JSON Key | Range | Default | Description |
|---|---|---|---|---|
| DRY Multiplier | `dry_multiplier` | 0.0–5.0 | 0.0 | "Don't Repeat Yourself" penalty strength. 0 = disabled. |
| DRY Base | `dry_base` | 1.0–4.0 | 1.75 | Exponential base for DRY penalty growth. |
| DRY Allowed Length | `dry_allowed_length` | 1–20 | 2 | Minimum sequence length before DRY applies. |
| XTC Threshold | `xtc_threshold` | 0.0–0.5 | 0.1 | Exclude Top Choices threshold. |
| XTC Probability | `xtc_probability` | 0.0–1.0 | 0.0 | Probability of applying XTC. 0 = disabled. |
| Dynamic Temperature | `dynatemp` | boolean | false | Scales temperature based on top token likelihood. |
| Min Temp | `min_temp` | 0.0–5.0 | 0.75 | Lower bound for dynamic temperature. |
| Max Temp | `max_temp` | 0.0–5.0 | 1.25 | Upper bound for dynamic temperature. |
| Mirostat Mode | `mirostat_mode` | 0–2 | 0 | Adaptive perplexity matching. 0 = disabled. |
| Mirostat Tau | `mirostat_tau` | 0.0–10.0 | 5.0 | Target perplexity for Mirostat. |
| Mirostat Eta | `mirostat_eta` | 0.0–1.0 | 0.1 | Mirostat learning rate. |
| Epsilon Cutoff | `epsilon_cutoff` | 0–9 (×1e-4) | 0 | Absolute probability floor. In units of 1e-4. |
| Eta Cutoff | `eta_cutoff` | 0–20 (×1e-4) | 0 | Eta sampling threshold. In units of 1e-4. |
| Smoothing Factor | `smoothing_factor` | 0.0–10.0 | 0.0 | Quadratic sampling smoothing. |

### Generation Control

| Parameter | JSON Key | Range | Default | Description |
|---|---|---|---|---|
| Max Tokens | `max_length` | 1–4096+ | 256–512 | Maximum tokens the model will generate per response. |
| Seed | `seed` | -1 or 0+ | -1 | Fixed seed for reproducible generation. -1 = random. |
| Do Sample | `do_sample` | boolean | true | Whether to use sampling (vs. greedy decoding). |
| Add BOS Token | `add_bos_token` | boolean | true | Prepend beginning-of-sequence token. |
| Skip Special Tokens | `skip_special_tokens` | boolean | true | Strip special tokens from output. |
| Banned Tokens | `banned_tokens` | string | "" | JSON array of token strings to ban. |

**Sources:** `public/scripts/textgen-settings.js` lines 143–236; `public/scripts/kai-settings.js` lines 28–50; `public/scripts/nai-settings.js` lines 36–62

---

## Sampler Ordering

The order in which samplers are applied significantly affects output quality. Different backends use different default orders.

### Why Order Matters

Samplers that truncate the token distribution (Top K, Top P, Min P) should generally run **before** temperature, so that temperature scaling operates on an already-filtered set of candidates. Running temperature first can amplify unlikely tokens before truncation removes them.

### Default Orders by Backend

**llama.cpp** (`LLAMACPP_DEFAULT_ORDER`): 10 samplers
```
Top K → TFS → Typical P → Top P → Min P → XTC → Temperature → DRY → Penalties → ...
```

**Ooba / TextGenWebUI** (`OOBA_DEFAULT_ORDER`): 20 samplers
```
Top K → Top A → Top P → Min P → TFS → Typical P → Epsilon → Eta → Temperature → DRY → Penalties → ...
```

**KoboldCPP** (`KOBOLDCPP_ORDER`): 7 samplers (uses numeric IDs)
```
Top K → Top A → Top P → TFS → Typical → Temperature → ...
```

**Aphrodite** (`APHRODITE_DEFAULT_ORDER`): 15 samplers

### Configuring Sampler Order

In the SillyTavern UI, sampler order can be rearranged via a drag-and-drop interface under the sampler settings. The order is stored in the preset JSON as:

```json
{
    "sampler_priority": [
        "min_p",
        "top_k",
        "top_p",
        "temperature"
    ]
}
```

**Recommendation:** For modern models (2024/2025), a minimal effective sampler stack is:
1. **Min P** (e.g., 0.05–0.1)
2. **Temperature** (e.g., 0.8–1.2)
3. **Repetition Penalty** (e.g., 1.05–1.15, optional)
4. All other samplers neutralized (set to disabled values)

**Source:** `public/scripts/textgen-settings.js` lines 67–116

---

## Chat Completion Presets

Chat Completion presets are far more complex than Text Completion presets. They combine generation parameters **and** the entire Prompt Manager configuration (all custom prompts, their ordering, and their content) into a single JSON file.

### Key Differences from Text Completion Presets

| Aspect | Text Completion | Chat Completion |
|---|---|---|
| Prompt construction | Advanced Formatting panel (separate) | Prompt Manager (inside preset) |
| Preset contains prompts? | No | Yes — all custom prompt content |
| Prompt ordering | Story String template (separate) | `prompt_order` array in preset JSON |
| System prompt | Separate system prompt preset | Embedded in preset's `prompts` array |

### Chat Completion Preset JSON Structure

A Chat Completion preset JSON contains these major sections:

```json
{
    // --- Generation Parameters ---
    "temperature": 1.0,
    "frequency_penalty": 0,
    "presence_penalty": 0,
    "top_p": 1.0,
    "top_k": 0,
    "max_context_unlocked": true,
    "openai_max_context": 16384,
    "openai_max_tokens": 600,
    "seed": -1,

    // --- Prompt Content ---
    "main_prompt": "Write {{char}}'s next reply in a fictional chat...",
    "nsfw_prompt": "NSFW/Smut is allowed...",
    "jailbreak_prompt": "",
    "impersonation_prompt": "[Write your reply from {{user}}'s perspective...]",
    "continue_nudge_prompt": "[Continue the following message...]",

    // --- Toggles ---
    "nsfw_toggle": false,
    "jailbreak_toggle": false,
    "enhance_definitions": false,
    "wi_format": "{0}",
    "wrap_in_quotes": false,
    "send_if_empty": "",
    "group_nudge_prompt": "",

    // --- Prompt Manager Data ---
    "prompts": [
        {
            "identifier": "main",
            "name": "Main Prompt",
            "system_prompt": true,
            "role": "system",
            "content": "Write {{char}}'s next reply...",
            "enabled": true,
            "marker": false
        },
        {
            "identifier": "nsfw",
            "name": "NSFW Prompt",
            "system_prompt": true,
            "role": "system",
            "content": "NSFW content is allowed...",
            "enabled": false,
            "marker": false
        },
        {
            "identifier": "dialogueExamples",
            "name": "Chat Examples",
            "system_prompt": true,
            "role": "system",
            "content": "",
            "enabled": true,
            "marker": true
        },
        {
            "identifier": "chatHistory",
            "name": "Chat History",
            "system_prompt": true,
            "role": "system",
            "content": "",
            "enabled": true,
            "marker": true
        },
        {
            "identifier": "jailbreak",
            "name": "Post-History Instructions",
            "system_prompt": true,
            "role": "system",
            "content": "",
            "enabled": false,
            "marker": false
        },
        {
            "identifier": "my_custom_prompt_001",
            "name": "My Custom Instructions",
            "system_prompt": false,
            "role": "system",
            "content": "Additional instructions go here...",
            "enabled": true,
            "marker": false,
            "injection_position": 0,
            "injection_depth": 4,
            "injection_order": 100,
            "filter_to": []
        }
    ],

    // --- Prompt Ordering ---
    "prompt_order": [
        {
            "character_id": 100000,
            "order": [
                { "identifier": "main", "enabled": true },
                { "identifier": "nsfw", "enabled": false },
                { "identifier": "charDescription", "enabled": true },
                { "identifier": "charPersonality", "enabled": true },
                { "identifier": "scenario", "enabled": true },
                { "identifier": "personaDescription", "enabled": true },
                { "identifier": "dialogueExamples", "enabled": true },
                { "identifier": "worldInfoBefore", "enabled": true },
                { "identifier": "chatHistory", "enabled": true },
                { "identifier": "worldInfoAfter", "enabled": true },
                { "identifier": "my_custom_prompt_001", "enabled": true },
                { "identifier": "jailbreak", "enabled": false }
            ]
        }
    ]
}
```

### Prompt Object Fields

Each entry in the `prompts` array has these fields:

| Field | Type | Description |
|---|---|---|
| `identifier` | string | Unique ID for the prompt. Built-in IDs: `main`, `nsfw`, `jailbreak`, `charDescription`, `charPersonality`, `scenario`, `personaDescription`, `dialogueExamples`, `chatHistory`, `worldInfoBefore`, `worldInfoAfter` |
| `name` | string | Display name in the Prompt Manager UI (not sent to the model) |
| `system_prompt` | boolean | Whether this is a system-level prompt |
| `role` | string | Message role: `"system"`, `"user"`, or `"assistant"` |
| `content` | string | The actual prompt text. Supports `{{macros}}`. |
| `enabled` | boolean | Whether the prompt is active |
| `marker` | boolean | If true, this is a structural marker (like `chatHistory`), not editable content |
| `injection_position` | number | `0` = relative (depth from end), `1` = absolute position in chat |
| `injection_depth` | number | How many messages from the end to inject. Only used for "In-Chat" positioned prompts. |
| `injection_order` | number | Ordering priority when multiple prompts share the same depth. Default: 100. |
| `filter_to` | array | Generation types this prompt applies to: `[]` = all, or subset of `["normal", "continue", "impersonate", "quiet", "swipe"]` |

### Built-in Marker Identifiers

These identifiers represent structural elements that SillyTavern inserts automatically. They cannot have custom content but can be reordered and enabled/disabled:

| Identifier | Represents |
|---|---|
| `charDescription` | Character card description |
| `charPersonality` | Character card personality field |
| `scenario` | Character card scenario field |
| `personaDescription` | User persona description |
| `dialogueExamples` | Example chat messages from the character card |
| `worldInfoBefore` | World Info entries set to "Before Char" |
| `worldInfoAfter` | World Info entries set to "After Char" |
| `chatHistory` | The actual chat message history |

---

## Prompt Manager System

The Prompt Manager is the visual interface for organizing prompts in Chat Completion presets.

### Accessing the Prompt Manager

1. Click the **AI Response Configuration** button in the navigation bar (the "sliders" icon).
2. The Prompt Manager appears below the common settings panel.

### Quick Edit Section

At the top of the Prompt Manager, three prompts can be edited directly without opening the full editor:

- **Main Prompt** — The primary system instruction
- **Auxiliary Prompt** (NSFW Prompt) — Optional additional instructions
- **Post-History Instructions (PHI)** — Injected after the chat history, just before the model responds. This has **maximum influence** on the model's next output.

### Prompt List (Drag-and-Drop)

Below the quick edit area is the ordered prompt list. This is a drag-and-drop interface where:

- Prompts higher in the list are sent earlier (closer to the "top" of context)
- Prompts lower in the list are sent later (closer to the model's response)
- Each prompt can be toggled on/off with a checkbox
- The `chatHistory` marker divides "before history" prompts from "after history" prompts

### Creating Custom Prompts

1. Click **New prompt** in the Prompt Manager
2. Fill in the fields:
   - **Name:** Your label (not sent to model)
   - **Role:** System, User, or Assistant
   - **Position:** "Before Chat" or "In-Chat"
   - **Depth:** (for In-Chat only) how many messages from the end
   - **Filter To:** which generation types to activate for
   - **Content:** the actual prompt text
3. Click **Save**
4. Select the new prompt from the dropdown → click **Insert prompt** to add it to the order
5. **Save the preset** using the Save button at the top of the AI Response Configuration panel

**Important:** You must save both the individual prompt (Save button in the editor) AND the preset itself (Save button at the top). Otherwise changes are lost when switching presets.

### Prompt Position System

| Position Type | Constant | Behavior |
|---|---|---|
| Relative | `INJECTION_POSITION.RELATIVE` (0) | Injected at `injection_depth` messages from the end of the scan range |
| Absolute | `INJECTION_POSITION.ABSOLUTE` (1) | Injected at an absolute position in the chat history |

When multiple prompts share the same depth, `injection_order` (default: 100) determines their sequence — lower values come first.

**Source:** `public/scripts/PromptManager.js` lines 31–40

---

## Context Templates

Context templates (also called "story string" templates) define how character information is assembled into the prompt for **Text Completion APIs**. They control the structural layout of the character description, personality, scenario, and other elements.

### Context Template JSON Structure

```json
{
    "story_string": "{{#if system}}{{system}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{personality}}\n{{/if}}{{#if scenario}}{{scenario}}\n{{/if}}{{#if persona}}{{persona}}\n{{/if}}",
    "example_separator": "",
    "chat_start": "",
    "use_stop_strings": false,
    "always_force_name2": true,
    "trim_sentences": false,
    "include_newline": false,
    "single_line": false,
    "name": "Default"
}
```

### Key Fields

| Field | Description |
|---|---|
| `story_string` | Handlebars template that assembles character data. Uses `{{#if field}}` blocks. |
| `example_separator` | Text inserted between example message blocks |
| `chat_start` | Text inserted at the start of chat history |
| `use_stop_strings` | Whether to apply stop strings |
| `always_force_name2` | Always prefix assistant messages with the character name |
| `trim_sentences` | Trim incomplete sentences from output |

### Available Template Variables

| Variable | Content |
|---|---|
| `{{system}}` | System prompt text |
| `{{description}}` | Character description |
| `{{personality}}` | Character personality summary |
| `{{scenario}}` | Scenario text |
| `{{persona}}` | User persona description |
| `{{mesExamples}}` | Example messages |
| `{{char}}` | Character name |
| `{{user}}` | User name |

### Template Derivation

For Text Completion backends using llama.cpp or KoboldCpp, SillyTavern can automatically derive the correct context template from the model's `tokenizer_config.json` chat template hash. Enable "Derive templates" in the Advanced Formatting menu. This only works for default templates (Llama 3, Gemma 2, Mistral V7, etc.).

---

## Instruct Templates

Instruct templates define how individual messages are wrapped with special tokens for instruction-following models. They tell SillyTavern how to format the system/user/assistant turns.

### Instruct Template JSON Structure

```json
{
    "system_prompt": "You are a helpful assistant.",
    "input_sequence": "<|start_header_id|>user<|end_header_id|>\n\n",
    "output_sequence": "<|start_header_id|>assistant<|end_header_id|>\n\n",
    "system_sequence": "<|start_header_id|>system<|end_header_id|>\n\n",
    "first_output_sequence": "",
    "last_output_sequence": "",
    "system_sequence_prefix": "",
    "system_sequence_suffix": "",
    "stop_sequence": "<|eot_id|>",
    "separator_sequence": "",
    "wrap": true,
    "macro": true,
    "names": false,
    "names_force_groups": true,
    "activation_regex": "",
    "skip_examples": false,
    "output_suffix": "<|eot_id|>",
    "input_suffix": "<|eot_id|>",
    "system_suffix": "<|eot_id|>",
    "user_alignment_message": "",
    "system_same_as_user": false,
    "last_system_sequence": "",
    "name": "Llama 3"
}
```

### Key Fields

| Field | Description |
|---|---|
| `input_sequence` | Prefix before user messages |
| `output_sequence` | Prefix before assistant/character messages |
| `system_sequence` | Prefix before system messages |
| `stop_sequence` | Token(s) that signal end of a turn |
| `output_suffix` / `input_suffix` / `system_suffix` | Appended after each message type |
| `wrap` | Whether to wrap messages with sequences at all |
| `macro` | Whether to process macros in sequences |
| `names` | Whether to include character/user names in messages |
| `names_force_groups` | Force names in group chats even if `names` is off |
| `activation_regex` | Regex to auto-activate this template based on model name |

### Common Instruct Formats

**ChatML:**
```
<|im_start|>system\n{content}<|im_end|>
<|im_start|>user\n{content}<|im_end|>
<|im_start|>assistant\n{content}<|im_end|>
```

**Llama 3:**
```
<|start_header_id|>system<|end_header_id|>\n\n{content}<|eot_id|>
<|start_header_id|>user<|end_header_id|>\n\n{content}<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>\n\n{content}<|eot_id|>
```

**Alpaca:**
```
### Instruction:\n{content}\n\n### Response:\n{content}
```

**Mistral V7:**
```
[INST] {content} [/INST] {content}</s>
```

---

## System Prompts

System prompts are standalone text presets that provide the foundational instruction to the model. They are stored as simple JSON files:

```json
{
    "name": "My System Prompt",
    "content": "You are a creative writing partner engaged in a collaborative storytelling session with {{user}}. Write immersive, detailed prose...",
    "marker_content": ""
}
```

### Tips for System Prompts

- System prompts are processed first and establish the "persona" and "rules" for the model.
- They sit at the **top** of the context (in Text Completion via story string) or as the first system message (in Chat Completion).
- Use `{{char}}` and `{{user}}` macros for dynamic name substitution.
- For Text Completion: the system prompt is part of the story string context template.
- For Chat Completion: it's a dedicated prompt in the Prompt Manager, usually the `main` prompt.
- Switching system prompts mid-conversation may not take full effect — always start a new chat when testing system prompt changes.

---

## Reasoning Templates

Reasoning templates control how model chain-of-thought or "thinking" output is displayed and handled. These are relevant for models that support reasoning/thinking tokens.

```json
{
    "name": "Default",
    "regex": "",
    "prefix": "<think>",
    "suffix": "</think>",
    "display": true,
    "collapse": true
}
```

---

## Prompt Layering and Construction

SillyTavern assembles the final prompt in layers. Understanding this layering is essential for placing instructions where they will have the most impact.

### Layer Order (Top to Bottom)

```
┌─────────────────────────────────────────────┐
│  1. FOUNDATION (Earliest / Least Recency)   │
│     - Main Prompt / System Instructions      │
│     - NSFW Prompt (if enabled)               │
├─────────────────────────────────────────────┤
│  2. CHARACTER DATA                           │
│     - Character Description                  │
│     - Personality Summary                    │
│     - Scenario                               │
│     - User Persona Description               │
├─────────────────────────────────────────────┤
│  3. MID-CONTEXT                              │
│     - Example Messages                       │
│     - World Info (Before/After)              │
│     - Chat History (oldest → newest)         │
├─────────────────────────────────────────────┤
│  4. RECENT (Closest to Response)             │
│     - Author's Note (injected at depth)      │
│     - Recent Messages                        │
├─────────────────────────────────────────────┤
│  5. MAXIMUM IMPACT                           │
│     - Post-History Instructions (PHI)        │
│     - Start Reply With prefix (if set)       │
└─────────────────────────────────────────────┘
         ↓ Model generates response here ↓
```

### Key Insights

- **Position determines influence.** Content closer to the model's response has stronger influence on the output. The Post-History Instructions (PHI) are the single most impactful prompt position.
- **Context budget.** All layers compete for the total context window. If the chat history is long, earlier prompts (character description, etc.) may be truncated first. SillyTavern shows a dotted line in chat to indicate the context boundary.
- **In-Chat injection.** Custom prompts with "In-Chat" position and a specific depth let you inject instructions at any point within the chat history, which is useful for "Author's Note" style nudges.

---

## Master Import / Export

SillyTavern supports bundling multiple preset types into a single "master" JSON file for easy sharing and backup.

### Master File Structure

A master file can contain any combination of these sections:

```json
{
    "preset": { /* Text Completion sampler settings */ },
    "context": { /* Context template */ },
    "instruct": { /* Instruct template */ },
    "sysprompt": { /* System prompt */ },
    "reasoning": { /* Reasoning template */ }
}
```

For Chat Completion presets, a master file may also just be a single Chat Completion preset JSON (which already contains prompts, ordering, and parameters).

### Import Flow

1. SillyTavern validates the JSON structure
2. Detects which sections are present
3. For legacy single-preset imports (instruct/context/preset only), auto-detects format
4. Presents checkboxes for each available section to import
5. Calls the appropriate preset manager's `setData()` for each selected section
6. Shows a toast notification listing imported sections

### Export Flow

1. Collects current data from each preset manager via `getData()`
2. Bundles all sections into a single JSON object
3. Downloads as a `.json` file

### How to Identify a Master File

Open the JSON in a text editor. If it contains multiple top-level keys like `preset`, `context`, `instruct`, and `sysprompt`, it's a master file. Import it via the "Capital A" tab's Import button.

**Source:** `public/scripts/preset-manager.js` lines 207–370

---

## PresetManager API (for Extension Developers)

Extensions can interact with the preset system via `SillyTavern.getContext().getPresetManager()`.

```javascript
const { getPresetManager } = SillyTavern.getContext();
const pm = getPresetManager();

// Read extension data from current preset
const value = pm.readPresetExtensionField({ path: 'my_field' });

// Write extension data to current preset
await pm.writePresetExtensionField({ path: 'my_field', value: 'data' });
```

### PresetManager Methods

| Method | Description |
|---|---|
| `getPresetList()` | Returns array of available preset names |
| `getSelectedPreset()` | Returns name of currently selected preset |
| `selectPreset(name)` | Switches to a named preset |
| `savePreset(name?, data?)` | Saves current or provided data as a preset |
| `deletePreset(name)` | Deletes a preset by name |
| `readPresetExtensionField({path})` | Reads custom extension data from preset |
| `writePresetExtensionField({path, value})` | Writes custom extension data to preset |

**Source:** `public/scripts/preset-manager.js` lines 843–894

---

## Preset Extension Data

Presets support an `extensions` field for storing custom data from extensions or user scripts. This is useful for extensions that need per-preset configuration.

```json
{
    "temp": 1.0,
    "top_p": 0.9,
    "extensions": {
        "my_extension_key": {
            "custom_setting": true,
            "value": 42
        }
    }
}
```

Read and write this data programmatically via the `PresetManager` API (see above).

---

## Auto-Selection System

SillyTavern can automatically select a preset when a character or group is loaded, if a preset shares the same name.

### How It Works

1. Triggered on character or group selection change
2. Extracts the character/group name
3. Uses fuzzy matching to find a preset with a matching name
4. If found and different from current preset, switches automatically

### Practical Use

Name a Chat Completion preset the same as a character card (e.g., both named "Luna") and SillyTavern will auto-load that preset when you open a chat with that character. This is convenient but can be confusing — **name presets uniquely** if you don't want this behavior.

**Source:** `public/scripts/preset-manager.js` lines 49–76

---

## Macros in Presets

Presets (especially Chat Completion presets and system prompts) support SillyTavern macros — placeholder tags that are replaced at generation time.

### Common Macros

| Macro | Replaced With |
|---|---|
| `{{char}}` | Character's display name |
| `{{user}}` | User's display name |
| `{{description}}` | Character description |
| `{{personality}}` | Character personality |
| `{{scenario}}` | Scenario text |
| `{{persona}}` | User persona description |
| `{{mesExamples}}` | Example messages |
| `{{lastChatMessage}}` | Content of the last chat message |
| `{{original}}` | Original content of the field being overridden (for character-specific overrides) |
| `{{trim}}` | Trims surrounding whitespace |
| `{{//}}` | Comment — content between `{{//}}` and the next `{{//}}` or end-of-string is stripped from the prompt (useful for notes and version info) |
| `{{time}}` | Current time |
| `{{date}}` | Current date |
| `{{random::a::b::c}}` | Random selection from provided options |
| `{{roll::NdM}}` | Dice roll (e.g., `{{roll::2d6}}`) |
| `{{idle_duration}}` | Time since last user message |
| `{{model}}` | Current model name |

---

## Backend-Specific Considerations

### llama.cpp / KoboldCpp
- Full sampler suite with DRY and XTC support
- Custom sampler order via `sampler_priority`
- Supports template derivation from model metadata
- Slot-based state saving/restoring

### Ooba / TextGenWebUI
- Largest sampler suite (20+ configurable samplers)
- Custom sampler priority ordering
- `temperature_last` option to apply temperature after other samplers

### vLLM / Aphrodite
- Limited sampler controls
- Top K uses `-1` for disabled state (instead of `0`)
- Custom sampler ordering supported

### Ollama
- Settings wrapped in an `options` object in the API request
- Separate API structure from other backends
- Multimodal model support for image captioning

### KoboldAI / Horde
- Uses its own preset format (`KoboldAI Settings/`)
- Sampler ordering uses numeric IDs
- Version-gated features detected via version comparison

### NovelAI
- Uses its own preset format (`NovelAI Settings/`)
- v3 presets are auto-converted on import via `convertNovelPreset()`
- Model-specific sampling parameters

### OpenRouter (Text Completion mode)
- Converted to chat completion format internally
- Provider filtering options

---

## Sampler Configuration Recipes

### Creative Writing / Roleplay
```json
{
    "temp": 1.0,
    "min_p": 0.05,
    "top_p": 1.0,
    "top_k": 0,
    "rep_pen": 1.05,
    "rep_pen_range": 2048,
    "max_length": 512
}
```
Higher temperature with light Min P filtering produces varied, creative output while maintaining coherence. Low repetition penalty keeps prose flowing without heavy-handed repetition prevention.

### Grounded / Instruction-Following
```json
{
    "temp": 0.7,
    "min_p": 0.1,
    "top_p": 0.9,
    "top_k": 40,
    "rep_pen": 1.1,
    "rep_pen_range": 1024,
    "max_length": 256
}
```
Lower temperature and tighter truncation produce more deterministic, instruction-following output.

### Code Generation
```json
{
    "temp": 0.2,
    "min_p": 0.1,
    "top_p": 0.7,
    "top_k": 20,
    "rep_pen": 1.2,
    "rep_pen_range": 512,
    "max_length": 1024
}
```
Very low temperature for precise, deterministic code output. Higher repetition penalty avoids boilerplate loops.

### Maximum Creativity (Experimental)
```json
{
    "temp": 1.3,
    "min_p": 0.02,
    "top_p": 1.0,
    "top_k": 0,
    "rep_pen": 1.0,
    "rep_pen_range": 0,
    "max_length": 512
}
```
Very high temperature with minimal filtering. Produces highly unpredictable, diverse output. May sacrifice coherence.

---

## Common Mistakes to Avoid

### 1. Hot-swapping presets mid-conversation
**Problem:** Changing presets (especially system prompts) mid-chat often doesn't take full effect because the model continues following patterns established by the chat history.
**Solution:** Always start a new chat when testing preset changes. At minimum, reload the SillyTavern UI.

### 2. Not saving the preset after editing prompts
**Problem:** Editing prompts in the Prompt Manager but forgetting to save the preset itself. Changes are lost when switching presets.
**Solution:** Always click Save on the individual prompt editor AND save the preset via the Save button at the top of AI Response Configuration.

### 3. Naming a preset the same as a character card
**Problem:** SillyTavern auto-selects presets that match character names. If your preset is named "Alice" and you have a character named "Alice," the preset will auto-load every time.
**Solution:** Use unique, descriptive preset names (e.g., "Creative Writing v2" instead of character names).

### 4. Setting all samplers to active values simultaneously
**Problem:** Stacking multiple truncation samplers (Top K + Top P + Min P + Top A + TFS + Typical P) aggressively restricts the token pool and produces flat, repetitive output.
**Solution:** Use a minimal sampler stack. The modern recommendation is Min P + Temperature + optional Repetition Penalty. Set unused samplers to their disabled values.

### 5. Using Text Completion settings for Chat Completion (or vice versa)
**Problem:** Copying sampler settings into a Chat Completion preset won't work because the field names and structure differ.
**Solution:** Use the correct preset type for your API. Text Completion uses `temp`, Chat Completion uses `temperature`. They are stored in different directories.

### 6. Ignoring sampler order
**Problem:** Applying temperature before truncation samplers amplifies unlikely tokens, leading to incoherent output.
**Solution:** Ensure truncation samplers (Min P, Top K, Top P) come before Temperature in the sampler order. Use `temperature_last: true` if available.

### 7. Forgetting `{{trim}}` in prompts with comments
**Problem:** Using `{{//}}` comment blocks without `{{trim}}` leaves extra whitespace in the final prompt, wasting tokens.
**Solution:** End comment blocks with `{{trim}}` to clean up whitespace.

### 8. Setting context length higher than the model supports
**Problem:** Setting `openai_max_context` or the context slider beyond what the model actually supports causes truncation errors or garbage output.
**Solution:** Check the model's actual context length and set your preset accordingly.

### 9. Putting critical instructions in the Main Prompt instead of PHI
**Problem:** The Main Prompt is at the top of context and has the least recency influence. Critical instructions placed there are easily "forgotten" in long conversations.
**Solution:** Put your most important behavioral instructions in the Post-History Instructions (PHI) position, which is the last thing the model sees before responding.

### 10. Not using `{{original}}` for character-specific overrides
**Problem:** Setting a character-specific Post-History Instruction without `{{original}}` replaces the global PHI entirely.
**Solution:** Include `{{original}}` in character-specific PHI fields to preserve the global instructions while adding character-specific ones.

---

## Reference Links

- **Official Prompt Manager Docs:** https://docs.sillytavern.app/usage/prompts/prompt-manager/
- **Official Prompts Guide:** https://docs.sillytavern.app/usage/prompts/
- **Official Advanced Formatting Docs:** https://docs.sillytavern.app/usage/core-concepts/advancedformatting/
- **Official Common Settings Docs:** https://docs.sillytavern.app/usage/common-settings/
- **DeepWiki — Preset and Sampler Management:** https://deepwiki.com/SillyTavern/SillyTavern/3.7-preset-and-sampler-management
- **DeepWiki — Prompt Management and Construction:** https://deepwiki.com/SillyTavern/SillyTavern/3.3-prompt-management-and-construction
- **DeepWiki — Prompt Manager System:** https://deepwiki.com/SillyTavern/SillyTavern/3.3.1-prompt-manager-system
- **PresetManager Source:** https://github.com/SillyTavern/SillyTavern/blob/staging/public/scripts/preset-manager.js
- **PromptManager Source:** https://github.com/SillyTavern/SillyTavern/blob/staging/public/scripts/PromptManager.js
- **TextGen Settings Source:** https://github.com/SillyTavern/SillyTavern/blob/staging/public/scripts/textgen-settings.js
- **ST Preset Editor (Visual Tool):** https://github.com/Nativu5/STPresetEditor — Online: https://stpe.nativus.workers.dev/
- **Community Preset Creator Guide:** https://github.com/cha1latte/sillytavern-preset-creator
- **Community Preset Database:** https://huggingface.co/Frowningface/Silly_Tavern_Presets_Database
- **Sphiratrioth Presets:** https://huggingface.co/sphiratrioth666/SillyTavern-Presets-Sphiratrioth
- **SillyTavern Releases (Changelog):** https://github.com/SillyTavern/SillyTavern/releases
