/**
 * Base boilerplate template for a Chat Completion preset.
 * Contains all fields that Claude does NOT need to decide —
 * model selectors, toggles, format strings, etc.
 *
 * Claude's creative output (prompts, parameters) is merged on top of this.
 */

export function getBasePresetTemplate() {
    return {
        // --- Model selectors (user configures in ST, not via preset generation) ---
        chat_completion_source: 'claude',
        openai_model: 'gpt-4o-mini',
        claude_model: 'claude-sonnet-4-20250514',
        openrouter_model: 'OR_Website',
        openrouter_use_fallback: false,
        openrouter_group_models: false,
        openrouter_sort_models: 'alphabetically',
        openrouter_providers: [],
        openrouter_quantizations: [],
        openrouter_allow_fallbacks: true,
        openrouter_middleout: 'on',
        ai21_model: 'jamba-large',
        mistralai_model: 'mistral-large-latest',
        cohere_model: 'command-r-plus',
        perplexity_model: 'sonar-pro',
        groq_model: 'llama-3.3-70b-versatile',
        chutes_model: 'deepseek-ai/DeepSeek-V3-0324',
        chutes_sort_models: 'alphabetically',
        siliconflow_model: 'deepseek-ai/DeepSeek-V3',
        siliconflow_endpoint: 'global',
        electronhub_model: 'gpt-4o-mini',
        electronhub_sort_models: 'alphabetically',
        electronhub_group_models: false,
        nanogpt_model: 'gpt-4o-mini',
        deepseek_model: 'deepseek-chat',
        aimlapi_model: 'gpt-4o-mini-2024-07-18',
        xai_model: 'grok-3-beta',
        pollinations_model: 'openai',
        moonshot_model: 'kimi-latest',
        fireworks_model: 'accounts/fireworks/models/kimi-k2-instruct',
        cometapi_model: 'gpt-4o',
        custom_model: '',
        custom_prompt_post_processing: 'semi_tools',
        google_model: 'gemini-2.5-pro',
        vertexai_model: 'gemini-2.5-pro',
        vertexai_auth_mode: 'express',
        zai_model: 'glm-5',
        zai_endpoint: 'coding',
        azure_openai_model: '',
        azure_api_version: '2024-02-15-preview',
        tool_reasoning_mode: 'disabled',

        // --- Generation parameters (Claude overrides these) ---
        temperature: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_p: 1,
        top_k: 0,
        top_a: 0,
        min_p: 0.05,
        repetition_penalty: 1,
        openai_max_context: 200000,
        openai_max_tokens: 4096,
        seed: -1,
        n: 1,

        // --- Context and streaming ---
        max_context_unlocked: true,
        stream_openai: true,

        // --- Names and empty-message behavior ---
        names_behavior: 0,
        send_if_empty: '',

        // --- Bias ---
        bias_preset_selected: 'Default (none)',

        // --- Format strings ---
        wi_format: '{0}',
        scenario_format: '[Circumstances and context of the dialogue: {{scenario}}]',
        personality_format: "[{{char}}'s personality: {{personality}}]",
        group_nudge_prompt: '',
        new_chat_prompt: '',
        new_group_chat_prompt: '',
        new_example_chat_prompt: '',

        // --- Impersonation and continue nudge (Claude can override) ---
        impersonation_prompt: "[Write your next reply from the perspective of {{user}}, using their voice and mannerisms.]",
        continue_nudge_prompt: "[Continue the following message. Do not include ANY parts of the original message. Use capitalization and punctuation as if your reply is a part of the original message: {{lastChatMessage}}]",

        // --- Toggles ---
        nsfw_toggle: false,
        jailbreak_toggle: false,
        enhance_definitions: false,
        wrap_in_quotes: false,

        // --- Prefill and postfix ---
        assistant_prefill: '',
        assistant_impersonation: '',
        continue_prefill: true,
        continue_postfix: ' ',
        use_sysprompt: true,
        squash_system_messages: true,

        // --- Advanced features ---
        function_calling: false,
        show_thoughts: true,
        reasoning_effort: 'auto',
        verbosity: 'auto',

        // --- Media ---
        media_inlining: true,
        inline_image_quality: 'auto',
        request_images: false,
        request_image_aspect_ratio: '',
        request_image_resolution: '',

        // --- Misc ---
        show_external_models: false,
        enable_web_search: false,
        bypass_status_check: false,
        extensions: {},

        // --- Top-level prompt fields (Claude provides these) ---
        main_prompt: '',
        nsfw_prompt: '',
        jailbreak_prompt: '',

        // --- Prompt data (Claude provides these) ---
        prompts: [],
        prompt_order: [],
    };
}
