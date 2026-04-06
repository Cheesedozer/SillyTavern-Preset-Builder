# SillyTavern Extension Development Reference

> **Purpose:** This document is a comprehensive reference for building SillyTavern UI extensions. It is sourced from the official SillyTavern documentation (https://docs.sillytavern.app/for-contributors/writing-extensions/) and the official example extension repository (https://github.com/city-unit/st-extension-example). Use this as your primary reference when building SillyTavern extensions from scratch.
>
> **Last Updated:** February 2026 — Based on SillyTavern 1.13.x / 1.14.x documentation.

---

## Table of Contents

1. [Overview](#overview)
2. [Extension Types](#extension-types)
3. [File Structure](#file-structure)
4. [manifest.json](#manifestjson)
5. [The SillyTavern Global Object](#the-sillytavern-global-object)
6. [getContext() API](#getcontext-api)
7. [Shared Libraries](#shared-libraries)
8. [State Management](#state-management)
9. [Events System](#events-system)
10. [Slash Command Registration](#slash-command-registration)
11. [Generating Text](#generating-text)
12. [Structured Outputs](#structured-outputs)
13. [Function Calling / Tool Registration](#function-calling--tool-registration)
14. [Prompt Interceptors](#prompt-interceptors)
15. [Custom Macros](#custom-macros)
16. [Internationalization (i18n)](#internationalization-i18n)
17. [Importing From SillyTavern Internals](#importing-from-sillytavern-internals)
18. [TypeScript Support](#typescript-support)
19. [Bundled Extensions (Webpack)](#bundled-extensions-webpack)
20. [UI Best Practices](#ui-best-practices)
21. [Security Best Practices](#security-best-practices)
22. [Performance Best Practices](#performance-best-practices)
23. [Server Plugins (Node.js)](#server-plugins-nodejs)
24. [Complete Extension Template](#complete-extension-template)
25. [Common Mistakes to Avoid](#common-mistakes-to-avoid)

---

## Overview

SillyTavern UI extensions run in the browser and hook into SillyTavern's event system and APIs. They have full access to the DOM, JavaScript APIs, and the SillyTavern context. Extensions can modify the UI, call internal APIs, interact with chat data, register slash commands, intercept generation requests, and respond to system events — all without modifying core SillyTavern code.

**Key principle:** Extensions interact with SillyTavern primarily through the `SillyTavern` global object, specifically `SillyTavern.getContext()`. This is the stable API. Direct imports from SillyTavern's internal modules are unreliable and may break between versions.

---

## Extension Types

There are two types of extensions in SillyTavern:

1. **UI Extensions** (this document's focus) — Client-side JavaScript that runs in the browser. Installed into the extensions directory.
2. **Server Plugins** — Node.js modules that run on the SillyTavern server. These can create new API endpoints and use Node.js packages. See [Server Plugins](#server-plugins-nodejs) section.

**Important:** The "Extras" project (SillyTavern-Extras) was **discontinued in April 2024**. You do NOT need Extras to use or build extensions. Do not reference Extras APIs in new extensions.

---

## File Structure

A SillyTavern extension is a directory containing at minimum:

```
my-extension/
├── manifest.json    # REQUIRED - Extension metadata
├── index.js         # REQUIRED - Main entry point (name must match manifest "js" field)
├── style.css        # OPTIONAL - Styles (name must match manifest "css" field)
├── example.html     # OPTIONAL - HTML template for settings panel
├── global.d.ts      # OPTIONAL - TypeScript declarations for autocomplete
├── README.md        # RECOMMENDED - Documentation
└── i18n/            # OPTIONAL - Localization files
    └── de-de.json
```

### Installation Locations

- **For all users (development):** Place directly in `/public/scripts/extensions/third-party/`
- **Per-user (installed via UI):** Located in `data/<user-handle>/extensions/`
- **When served over HTTP:** Mounted at `/scripts/extensions/third-party/`

**All relative imports should be based on the `/scripts/extensions/third-party/` mount path.**

---

## manifest.json

Every extension MUST have a `manifest.json`. Here is the complete schema:

```json
{
    "display_name": "My Extension Name",
    "loading_order": 1,
    "requires": [],
    "optional": [],
    "dependencies": [],
    "js": "index.js",
    "css": "style.css",
    "author": "Your Name",
    "version": "1.0.0",
    "homePage": "https://github.com/your/extension",
    "auto_update": true,
    "minimum_client_version": "1.12.0",
    "generate_interceptor": "myInterceptorFunction",
    "i18n": {
        "de-de": "i18n/de-de.json"
    }
}
```

### Field Reference

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `display_name` | **Yes** | string | Shown in "Manage Extensions" menu |
| `js` | **Yes** | string | Path to main JavaScript entry file |
| `author` | **Yes** | string | Author name or contact info |
| `css` | No | string | Path to CSS style file |
| `loading_order` | No | number | Higher number = loads later |
| `version` | No | string | Semantic version string |
| `homePage` | No | string | URL to extension homepage/repo |
| `auto_update` | No | boolean | Auto-update when ST version changes |
| `minimum_client_version` | No | string | Minimum SillyTavern version required |
| `generate_interceptor` | No | string | Name of a global function called on text generation requests |
| `dependencies` | No | string[] | Other extensions this depends on (by folder name) |
| `i18n` | No | object | Locale code → JSON file path mapping |

### Dependencies Format

Dependencies reference extensions by their **folder name** in `public/extensions/`:

```json
{
    "dependencies": [
        "vectors",
        "caption",
        "third-party/Extension-WebLLM",
        "third-party/Extension-Mermaid"
    ]
}
```

The extension will NOT load if any dependency is missing or disabled.

### Deprecated Fields (do NOT use)

- `requires` — Was for Extras modules (Extras is discontinued)
- `optional` — Was for optional Extras modules

---

## The SillyTavern Global Object

The primary API surface for extensions is the `SillyTavern` global object, which is available on `window.SillyTavern` or just `SillyTavern`.

```javascript
// Access the context
const context = SillyTavern.getContext();

// Access shared libraries
const { DOMPurify, lodash, Fuse } = SillyTavern.libs;
```

**Always use `SillyTavern.getContext()` over direct imports.** The context API is more stable and less likely to break with SillyTavern updates.

---

## getContext() API

`SillyTavern.getContext()` returns an object with state, functions, and utilities. Key properties include:

### State Properties

```javascript
const context = SillyTavern.getContext();

// Chat & Characters
context.chat;                  // Array - Current chat log (MUTABLE)
context.characters;            // Array - Character list
context.characterId;           // Number - Index of current character (undefined in groups or no selection)
context.groups;                // Array - Group list
context.groupId;               // String - ID of current group
context.name1;                 // String - User's display name
context.name2;                 // String - Character's display name
context.chatMetadata;          // Object - Per-chat metadata storage
context.extensionSettings;     // Object - Global extension settings storage

// Events
context.eventSource;           // EventEmitter - Main event bus
context.event_types;           // Object - Enum of all event type constants
```

### Key Functions

```javascript
const context = SillyTavern.getContext();

// Settings persistence
context.saveSettingsDebounced();          // Save extension settings (debounced)
context.saveMetadata();                   // Save chat metadata to server

// Text generation
context.generateQuietPrompt(params);      // Generate text with chat context (background)
context.generateRaw(params);              // Generate text without chat context

// Character data
context.writeExtensionField(characterId, key, value); // Write to character card extensions field

// Slash commands
context.registerSlashCommand(name, callback, aliases, helpString); // Legacy registration

// Function tools
context.registerFunctionTool(toolDef);    // Register a function tool for LLM tool calling
context.unregisterFunctionTool(name);     // Unregister a function tool
context.isToolCallingSupported();         // Check if tool calling is available

// Macros
context.registerMacro(name, valueOrFn);   // Register a custom macro
context.unregisterMacro(name);            // Remove a custom macro

// Localization
context.addLocaleData(locale, data);      // Add localized strings
context.t(key);                           // Translate a string

// Presets
context.getPresetManager();               // Get PresetManager for current API

// Popup/UI utilities
context.Popup;                            // Popup class for dialogs
```

### Full Context Source

The complete list of `getContext()` properties is defined in:
`https://github.com/SillyTavern/SillyTavern/blob/staging/public/scripts/st-context.js`

---

## Shared Libraries

SillyTavern bundles common npm libraries and shares them via `SillyTavern.libs`:

```javascript
const {
    lodash,       // Utility library (https://lodash.com/)
    localforage,  // Browser storage / IndexedDB abstraction
    Fuse,         // Fuzzy search library (https://www.fusejs.io/)
    DOMPurify,    // HTML sanitization (https://github.com/cure53/DOMPurify)
    Handlebars,   // Templating library (https://handlebarsjs.com/)
    moment,       // Date/time manipulation (http://momentjs.com/)
    showdown,     // Markdown converter (https://showdownjs.com/)
    hljs,         // Syntax highlighting
    yaml,         // YAML parser
} = SillyTavern.libs;
```

### Usage Examples

```javascript
// Sanitize HTML
const { DOMPurify } = SillyTavern.libs;
const clean = DOMPurify.sanitize('<script>alert("xss")</script><b>Safe</b>');

// Lodash utilities
const { lodash } = SillyTavern.libs;
const unique = lodash.uniq([1, 2, 2, 3]);
const grouped = lodash.groupBy(items, 'category');

// Fuzzy search
const { Fuse } = SillyTavern.libs;
const fuse = new Fuse(items, { keys: ['name', 'description'] });
const results = fuse.search('query');

// Templating
const { Handlebars } = SillyTavern.libs;
const template = Handlebars.compile('<div>{{name}}</div>');
const html = template({ name: 'Example' });

// Date formatting
const { moment } = SillyTavern.libs;
const formatted = moment().format('YYYY-MM-DD HH:mm:ss');
```

The full list is in: `https://github.com/SillyTavern/SillyTavern/blob/release/public/lib.js`

---

## State Management

### Persistent Extension Settings (Global)

Use `extensionSettings` from `getContext()` to persist settings across sessions. **Use a unique key** to avoid conflicts.

```javascript
const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();

const MODULE_NAME = 'my_unique_extension';

const defaultSettings = Object.freeze({
    enabled: false,
    option1: 'default',
    option2: 5,
});

function getSettings() {
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    // Ensure all default keys exist (important after updates)
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    return extensionSettings[MODULE_NAME];
}

// Read
const settings = getSettings();
console.log(settings.option1);

// Write
settings.option1 = 'new value';
saveSettingsDebounced();
```

**Alternative initialization with lodash merge:**

```javascript
function loadSettings() {
    extensionSettings[MODULE_NAME] = SillyTavern.libs.lodash.merge(
        structuredClone(defaultSettings),
        extensionSettings[MODULE_NAME]
    );
}
```

### Per-Chat Metadata

Store data specific to the current chat:

```javascript
const { chatMetadata, saveMetadata } = SillyTavern.getContext();

// Write
chatMetadata['my_key'] = 'my_value';
await saveMetadata();

// Read
const value = chatMetadata['my_key'];
```

**IMPORTANT:** Do NOT cache the `chatMetadata` reference in a long-lived variable. The reference changes when the chat switches. Always use `SillyTavern.getContext().chatMetadata` to access current metadata.

### Character Card Extension Data

Store data within character cards (shareable when exporting):

```javascript
const { writeExtensionField, characterId, characters } = SillyTavern.getContext();

// Write
await writeExtensionField(characterId, 'my_extension_key', {
    someData: 'value',
    anotherData: 42,
});

// Read
const character = SillyTavern.getContext().characters[characterId];
const myData = character.data?.extensions?.my_extension_key;
```

**Warning:** `characterId` is `undefined` in group chats or when no character is selected!

### Preset Extension Data

Store data in API preset files:

```javascript
const { getPresetManager } = SillyTavern.getContext();

const pm = getPresetManager();

// Write
await pm.writePresetExtensionField({ path: 'my_field', value: 'data' });

// Read
const value = pm.readPresetExtensionField({ path: 'my_field' });
```

### Storage Decision Guide

| Data Type | Where to Store | Persistence |
|-----------|---------------|-------------|
| Extension config/preferences | `extensionSettings` | Permanent (global) |
| Per-chat state | `chatMetadata` | Per-conversation |
| Character-specific data | Character card `extensions` field | Per-character (exportable) |
| Preset-specific data | Preset extension field | Per-preset |
| Large data (>100KB) | `localforage` (IndexedDB) | Permanent (browser) |
| Temporary runtime state | Module-level variables | Session only |

---

## Events System

The event system is the primary mechanism for extensions to react to application state changes.

### Subscribing to Events

```javascript
const { eventSource, event_types } = SillyTavern.getContext();

// Subscribe
eventSource.on(event_types.MESSAGE_RECEIVED, handleIncomingMessage);

function handleIncomingMessage(data) {
    console.log('New message received:', data);
}

// Unsubscribe (important for cleanup)
eventSource.removeListener(event_types.MESSAGE_RECEIVED, handleIncomingMessage);
```

### Key Event Types

| Event Constant | When It Fires | Notes |
|----------------|--------------|-------|
| `APP_INITIALIZED` | App initialized, loader still visible | Good for UI modifications. Auto-fires for late listeners. |
| `APP_READY` | App fully loaded and ready | Auto-fires for late listeners. |
| `MESSAGE_RECEIVED` | LLM message generated and recorded to `chat` | Not yet rendered in UI |
| `MESSAGE_SENT` | User message recorded to `chat` | Not yet rendered in UI |
| `USER_MESSAGE_RENDERED` | User message rendered in UI | |
| `CHARACTER_MESSAGE_RENDERED` | LLM message rendered in UI | |
| `CHAT_CHANGED` | Chat switched (new character, different chat loaded) | Good for reinitializing per-chat state |
| `GENERATION_AFTER_COMMANDS` | Generation about to start after slash commands processed | |
| `GENERATION_STOPPED` | Generation stopped by user | |
| `GENERATION_ENDED` | Generation completed or errored | |
| `SETTINGS_UPDATED` | Application settings changed | |
| `PRESET_CHANGED` | API preset was changed | |
| `MAIN_API_CHANGED` | Main API source was switched | |

**Full list:** `https://github.com/SillyTavern/SillyTavern/blob/staging/public/scripts/events.js`

**Note:** Event data varies per event type. Some pass objects, some primitives, some nothing. Check the source code for specifics.

### Emitting Custom Events

```javascript
const { eventSource } = SillyTavern.getContext();

// Emit a custom event (use await to ensure handlers complete)
await eventSource.emit('myCustomEvent', { data: 'custom event data' });
```

---

## Slash Command Registration

Register custom slash commands using the modern `SlashCommandParser.addCommandObject()` API:

```javascript
SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'mycommand',
    callback: (namedArgs, unnamedArgs) => {
        return `Result: ${unnamedArgs.toString()}`;
    },
    aliases: ['mc'],
    returns: 'the processed text',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'count',
            description: 'number of times to process',
            typeList: ARGUMENT_TYPE.NUMBER,
            defaultValue: '1',
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'reverse',
            description: 'whether to reverse the text',
            typeList: ARGUMENT_TYPE.BOOLEAN,
            defaultValue: 'off',
            enumList: ['on', 'off'],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the text to process',
            typeList: ARGUMENT_TYPE.STRING,
            isRequired: true,
        }),
    ],
    helpString: `
        <div>
            Processes the provided text.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li><pre><code class="language-stscript">/mycommand Hello</code></pre></li>
                <li><pre><code class="language-stscript">/mycommand count=3 reverse=on Hello</code></pre></li>
            </ul>
        </div>
    `,
}));
```

**Note:** To use `SlashCommandParser`, `SlashCommand`, `SlashCommandArgument`, `SlashCommandNamedArgument`, `ARGUMENT_TYPE`, and `isTrueBoolean`, you must import them. These are available from the SillyTavern modules:

```javascript
import { SlashCommandParser } from '../../../../scripts/slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../scripts/slash-commands/SlashCommand.js';
import { SlashCommandArgument } from '../../../../scripts/slash-commands/SlashCommandArgument.js';
import { SlashCommandNamedArgument } from '../../../../scripts/slash-commands/SlashCommandNamedArgument.js';
import { ARGUMENT_TYPE } from '../../../../scripts/slash-commands/SlashCommandArgument.js';
import { isTrueBoolean } from '../../../../scripts/utils.js';
```

All registered commands can be used in STscript.

---

## Generating Text

### Within Chat Context (Quiet Prompt)

Generates text with the current chat context but does NOT render output in the UI:

```javascript
const { generateQuietPrompt } = SillyTavern.getContext();

const result = await generateQuietPrompt({
    quietPrompt: 'Generate a summary of the chat history.',
});
console.log(result); // Generated text string
```

### Raw Generation (No Chat Context)

Full control over the prompt. Accepts a string (Text Completion) or array of objects (Chat Completion):

```javascript
const { generateRaw } = SillyTavern.getContext();

const result = await generateRaw({
    systemPrompt: 'You are a helpful assistant.',
    prompt: 'Generate a story about a brave knight.',
    prefill: 'Once upon a time,',
});
```

In Chat Completion mode, this produces:
```json
[
  {"role": "system", "content": "You are a helpful assistant."},
  {"role": "user", "content": "Generate a story about a brave knight."},
  {"role": "assistant", "content": "Once upon a time,"}
]
```

In Text Completion mode (no instruct), this produces:
```
You are a helpful assistant.
Generate a story about a brave knight.
Once upon a time,
```

---

## Structured Outputs

For Chat Completion API only. Forces the model to produce JSON matching a schema:

```javascript
const { generateRaw, generateQuietPrompt } = SillyTavern.getContext();

const jsonSchema = {
    name: 'StoryStateModel',              // Required: schema name
    description: 'A story state schema.', // Optional
    strict: true,                          // Optional: strict mode
    value: {                               // Required: the actual JSON Schema
        '$schema': 'http://json-schema.org/draft-04/schema#',
        'type': 'object',
        'properties': {
            'location': { 'type': 'string' },
            'plans': { 'type': 'string' },
            'memories': { 'type': 'string' },
        },
        'required': ['location', 'plans', 'memories'],
    },
};

const prompt = 'Generate a story state. Output as JSON.';

// With raw generation
const rawResult = await generateRaw({ prompt, jsonSchema });

// With quiet prompt
const quietResult = await generateQuietPrompt({ quietPrompt: prompt, jsonSchema });

// Parse the result (always validate!)
try {
    const parsed = JSON.parse(rawResult);
} catch (e) {
    console.error('Failed to parse structured output:', e);
}
```

**Notes:**
- Not all models/APIs support structured outputs
- Outputs are NOT validated against the schema by SillyTavern — you must handle parsing/validation
- If unsupported, generation may fail or return `'{}'`

---

## Function Calling / Tool Registration

Register tools that the LLM can invoke during generation:

```javascript
const context = SillyTavern.getContext();

// Check if supported first
if (context.isToolCallingSupported()) {
    context.registerFunctionTool({
        name: 'get_weather',
        displayName: 'Get Weather',
        description: 'Get current weather for a location. Use when the user asks about weather.',
        parameters: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'City name or location',
                },
            },
            required: ['location'],
        },
        action: async ({ location }) => {
            // Your implementation
            const weather = await fetchWeatherData(location);
            return JSON.stringify(weather);
        },
        formatMessage: ({ location }) => {
            return `Checking weather for ${location}...`;
        },
        shouldRegister: () => {
            // Optional: conditionally register
            return true;
        },
        stealth: false, // Set true to hide tool calls from chat history
    });
}

// Unregister when no longer needed
context.unregisterFunctionTool('get_weather');
```

### Tool Registration Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Unique internal name |
| `description` | Yes | string | What the tool does and when to use it |
| `parameters` | Yes | object | JSON Schema for parameters |
| `action` | Yes | function | Async function called when tool is triggered |
| `displayName` | No | string | Shown in UI |
| `formatMessage` | No | function | Custom toast message (return '' to suppress) |
| `shouldRegister` | No | function | Return boolean to conditionally register |
| `stealth` | No | boolean | Hide tool calls from chat history |

### Supported APIs for Function Calling

OpenAI, Claude, MistralAI, Groq, Cohere, OpenRouter, AI21, Google AI Studio, Google Vertex AI, DeepSeek, AI/ML API, NanoGPT, and Custom OpenAI-compatible sources.

**Limitations:**
- User must enable "Enable function calling" in AI Response Configuration
- No guarantee the LLM will use tools
- Continuations, impersonation, and quiet prompts cannot trigger tool calls

---

## Prompt Interceptors

Interceptors modify the chat/prompt BEFORE a generation request is sent:

### Setup via manifest.json

```json
{
    "display_name": "My Interceptor Extension",
    "loading_order": 10,
    "generate_interceptor": "myInterceptorFunction",
    "js": "index.js",
    "author": "Your Name"
}
```

### Implementation

The interceptor function MUST be defined on `globalThis`:

```javascript
globalThis.myInterceptorFunction = async function(chat, contextSize, abort, type) {
    // chat: Array of message objects (MUTABLE - changes affect actual chat)
    // contextSize: Number - context size in tokens
    // abort: Function - call to prevent generation. abort(true) stops subsequent interceptors too
    // type: String - 'quiet', 'regenerate', 'impersonate', 'swipe', etc.

    // Example: Add a system note before the last message
    if (type !== 'quiet') {
        const note = {
            is_user: false,
            name: 'System',
            send_date: Date.now(),
            mes: 'This was added by my extension!',
        };
        chat.splice(chat.length - 1, 0, note);
    }

    // Example: Abort generation conditionally
    // abort(false); // Abort but let other interceptors run
    // abort(true);  // Abort and skip remaining interceptors
};
```

**Important:** Messages in the `chat` array are mutable. Changes affect the actual chat history. If you want ephemeral changes, use `structuredClone()`:

```javascript
globalThis.myInterceptorFunction = async function(chat, contextSize, abort, type) {
    // Make ephemeral modification
    const lastMsg = chat[chat.length - 1];
    const clone = structuredClone(lastMsg);
    clone.mes += '\n[Modified by extension]';
    chat[chat.length - 1] = clone;
};
```

Interceptors run sequentially based on `loading_order` in their manifests.

---

## Custom Macros

Register macros usable anywhere macro substitution is supported (character cards, STscript, prompts, etc.):

```javascript
const { registerMacro, unregisterMacro } = SillyTavern.getContext();

// Simple string macro: {{fizz}} -> "buzz"
registerMacro('fizz', 'buzz');

// Function macro: {{tomorrow}} -> tomorrow's date
registerMacro('tomorrow', () => {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString();
});

// Cleanup
unregisterMacro('fizz');
```

**Limitations:**
- Only simple string replacement macros are currently supported
- Function macros MUST be synchronous (cannot return a Promise)
- Do NOT wrap in `{{ }}` when registering — SillyTavern handles that
- Too many macros may cause performance issues (regex-based substitution)

---

## Internationalization (i18n)

### Via manifest.json

```json
{
    "display_name": "My Extension",
    "js": "index.js",
    "i18n": {
        "fr-fr": "i18n/fr-fr.json",
        "de-de": "i18n/de-de.json"
    }
}
```

### Via code

```javascript
SillyTavern.getContext().addLocaleData('fr-fr', { 'Hello': 'Bonjour' });
SillyTavern.getContext().addLocaleData('de-de', { 'Hello': 'Hallo' });
```

Overrides of existing keys are NOT allowed. If the locale code doesn't match the user's current locale, data is silently ignored.

Use `data-i18n` attribute in HTML templates for automatic translation:
```html
<label data-i18n="Hello">Hello</label>
```

Supported locales: `https://github.com/SillyTavern/SillyTavern/blob/release/public/locales/lang.json`

---

## Importing From SillyTavern Internals

**Warning:** Direct imports from SillyTavern source files are unreliable and may break between versions. Prefer `SillyTavern.getContext()` whenever possible.

When you must import (e.g., for slash command classes), use relative paths based on the extension's mount point:

```javascript
// From /scripts/extensions/third-party/your-extension/index.js
// Up 4 levels to reach the public root

import { generateQuietPrompt } from '../../../../script.js';
import { SlashCommandParser } from '../../../../scripts/slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../scripts/slash-commands/SlashCommand.js';
import { SlashCommandArgument, ARGUMENT_TYPE } from '../../../../scripts/slash-commands/SlashCommandArgument.js';
import { SlashCommandNamedArgument } from '../../../../scripts/slash-commands/SlashCommandNamedArgument.js';
import { isTrueBoolean } from '../../../../scripts/utils.js';
```

---

## TypeScript Support

For autocomplete in your editor, create a `global.d.ts` file in your extension root:

```typescript
export {};

// 1. Import for user-scoped extensions (data/<user>/extensions/)
import '../../../../public/global';
// 2. Import for server-scoped extensions (public/scripts/extensions/third-party/)
import '../../../../global';

declare global {
    // Add your own global type declarations here
}
```

---

## Bundled Extensions (Webpack)

For complex extensions using NPM dependencies, React, Vue, etc., use bundling:

**Templates:**
- **Webpack + TypeScript (no React):** `https://github.com/SillyTavern/Extension-WebpackTemplate`
- **React + Webpack:** `https://github.com/SillyTavern/Extension-ReactTemplate`

### Import Wrapper for Webpack

When bundling, use this helper to import from SillyTavern at runtime (bypassing webpack):

```javascript
/**
 * Import a member from a module by URL, bypassing webpack.
 * @param {string} url URL to import from
 * @param {string} what Name of the member to import
 * @param {any} defaultValue Fallback value
 * @returns {Promise<any>} Imported member
 */
export async function importFromUrl(url, what, defaultValue = null) {
    try {
        const module = await import(/* webpackIgnore: true */ url);
        if (!Object.hasOwn(module, what)) {
            throw new Error(`No ${what} in module`);
        }
        return module[what];
    } catch (error) {
        console.error(`Failed to import ${what} from ${url}: ${error}`);
        return defaultValue;
    }
}

// Usage:
const generateRaw = await importFromUrl('/script.js', 'generateRaw');
```

### Bundled Extension Workflow

1. Click "Use this template" on GitHub
2. Clone and run `npm install`
3. Edit `manifest.json`
4. Write source code in `src/` directory
5. Run `npm run build`
6. Minimized bundle appears in `dist/`, ready for SillyTavern

---

## UI Best Practices

### Adding a Settings Panel

Load HTML from a template file and append to the extensions panel:

```javascript
// In index.js
const MODULE_NAME = 'my_extension';

// Load HTML template
const settingsHtml = await $.get(`/scripts/extensions/third-party/${MODULE_NAME}/example.html`);

// Append to extensions settings
$('#extensions_settings').append(settingsHtml);

// Bind UI events
$('#my_extension_toggle').on('change', function() {
    const settings = getSettings();
    settings.enabled = $(this).prop('checked');
    saveSettingsDebounced();
});
```

### HTML Template Example

```html
<!-- example.html -->
<div class="my_extension_settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b data-i18n="My Extension">My Extension</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="flex-container">
                <label for="my_extension_toggle">
                    <input id="my_extension_toggle" type="checkbox" />
                    <span data-i18n="Enable">Enable</span>
                </label>
            </div>
            <div class="flex-container">
                <label for="my_extension_input">
                    <span data-i18n="Setting">Setting:</span>
                </label>
                <input id="my_extension_input" type="text" class="text_pole" />
            </div>
        </div>
    </div>
</div>
```

### User Feedback

```javascript
const { Popup } = SillyTavern.getContext();

// Toast notifications (via toastr, globally available)
toastr.success('Data imported successfully');
toastr.error('Failed to connect to API');
toastr.warning('This feature is experimental');
toastr.info('Processing...');

// Popup dialogs
const confirmed = await Popup.show.confirm('Confirm', 'Are you sure?');
const userInput = await Popup.show.input('Input', 'Enter a value:', 'default');
await Popup.show.text('Info', 'Operation completed.');
```

### Console Logging

```javascript
const MODULE_NAME = 'MyExtension';

console.log(`[${MODULE_NAME}] Extension loaded`);
console.debug(`[${MODULE_NAME}] Debug data:`, data);
console.error(`[${MODULE_NAME}] Error:`, error);
```

---

## Security Best Practices

1. **NEVER store API keys or secrets in `extensionSettings`** — they are accessible to all extensions and stored in plain text. Use server plugins for sensitive data.

2. **Always sanitize user inputs:**
   ```javascript
   const { DOMPurify } = SillyTavern.libs;
   const cleanInput = DOMPurify.sanitize(userInput);
   ```

3. **Never use `eval()` or `Function()` constructors.**

---

## Performance Best Practices

1. **Don't store large data in `extensionSettings`** — use `localforage` instead:
   ```javascript
   const { localforage } = SillyTavern.libs;
   await localforage.setItem(`${MODULE_NAME}_data`, largeData);
   const data = await localforage.getItem(`${MODULE_NAME}_data`);
   ```

2. **Clean up event listeners:**
   ```javascript
   function cleanup() {
       eventSource.removeListener(event_types.MESSAGE_RECEIVED, handleMessage);
       document.getElementById('myElement')?.removeEventListener('click', handleClick);
   }
   ```

3. **Don't block the UI thread:**
   ```javascript
   async function heavyComputation(data) {
       for (let i = 0; i < data.length; i++) {
           // Process chunk
           if (i % 1000 === 0) {
               await new Promise(resolve => setTimeout(resolve, 0)); // Yield to UI
           }
       }
   }
   ```

---

## Server Plugins (Node.js)

Server plugins run on the Node.js server and can create API endpoints. They go in the `plugins/` directory and require `enableServerPlugins: true` in `config.yaml`.

**Warning:** Server plugins are NOT sandboxed — they have full filesystem access.

### Basic Server Plugin

```javascript
// plugins/my-plugin.js

async function init(router) {
    router.get('/hello', (req, res) => {
        res.json({ message: 'Hello from plugin!' });
    });

    router.post('/process', (req, res) => {
        const data = req.body;
        res.json({ result: 'processed' });
    });

    console.log('My plugin loaded!');
}

async function exit() {
    // Cleanup
}

module.exports = {
    init,
    exit,
    info: {
        id: 'my-plugin',
        name: 'My Plugin',
        description: 'Does cool things on the server',
    },
};
```

Routes are available at `/api/plugins/{id}/{route}` (e.g., `/api/plugins/my-plugin/hello`).

### Calling Plugin API from UI Extension

```javascript
const response = await fetch('/api/plugins/my-plugin/hello');
const data = await response.json();
```

**Templates:**
- **Webpack + TypeScript:** `https://github.com/SillyTavern/Plugin-WebpackTemplate`
- **Example:** `https://github.com/SillyTavern/SillyTavern-DiscordRichPresence-Server`

---

## Complete Extension Template

Here is a complete, working extension template:

### manifest.json

```json
{
    "display_name": "My Example Extension",
    "loading_order": 1,
    "requires": [],
    "optional": [],
    "dependencies": [],
    "js": "index.js",
    "css": "style.css",
    "author": "Your Name",
    "version": "1.0.0",
    "homePage": "https://github.com/your/repo",
    "auto_update": true
}
```

### index.js

```javascript
// Use a unique module name
const MODULE_NAME = 'my_example_extension';

// Default settings
const defaultSettings = Object.freeze({
    enabled: false,
    greeting: 'Hello!',
    maxItems: 10,
});

/**
 * Get or initialize extension settings.
 */
function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();

    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    return extensionSettings[MODULE_NAME];
}

/**
 * Update UI elements to reflect current settings.
 */
function updateUI() {
    const settings = getSettings();
    $('#my_ext_enabled').prop('checked', settings.enabled);
    $('#my_ext_greeting').val(settings.greeting);
    $('#my_ext_max_items').val(settings.maxItems);
}

/**
 * Handle incoming AI messages.
 */
function onMessageReceived(messageIndex) {
    const settings = getSettings();
    if (!settings.enabled) return;

    const { chat } = SillyTavern.getContext();
    const message = chat[messageIndex];
    console.log(`[${MODULE_NAME}] New message:`, message?.mes?.substring(0, 50));
}

/**
 * Handle chat changes.
 */
function onChatChanged() {
    console.log(`[${MODULE_NAME}] Chat changed`);
    // Reinitialize per-chat state here
}

/**
 * Initialize the extension.
 */
(async function init() {
    const context = SillyTavern.getContext();
    const { eventSource, event_types, saveSettingsDebounced } = context;

    // Load and inject settings HTML
    try {
        const settingsHtml = await $.get(
            `/scripts/extensions/third-party/${MODULE_NAME}/example.html`
        );
        $('#extensions_settings2').append(settingsHtml);
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to load settings HTML:`, error);
    }

    // Initialize settings and update UI
    getSettings();
    updateUI();

    // Bind UI events
    $('#my_ext_enabled').on('change', function () {
        const settings = getSettings();
        settings.enabled = $(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#my_ext_greeting').on('input', function () {
        const settings = getSettings();
        settings.greeting = $(this).val();
        saveSettingsDebounced();
    });

    $('#my_ext_max_items').on('input', function () {
        const settings = getSettings();
        settings.maxItems = Number($(this).val());
        saveSettingsDebounced();
    });

    // Subscribe to events
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    console.log(`[${MODULE_NAME}] Extension loaded successfully`);
})();
```

### example.html

```html
<div class="my_example_extension_settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>My Example Extension</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="flex-container">
                <label class="checkbox_label" for="my_ext_enabled">
                    <input id="my_ext_enabled" type="checkbox" />
                    <span>Enable Extension</span>
                </label>
            </div>
            <label for="my_ext_greeting">
                <span>Greeting Message:</span>
            </label>
            <input id="my_ext_greeting" type="text" class="text_pole" placeholder="Hello!" />
            <label for="my_ext_max_items">
                <span>Max Items:</span>
            </label>
            <input id="my_ext_max_items" type="number" class="text_pole" min="1" max="100" />
        </div>
    </div>
</div>
```

### style.css

```css
.my_example_extension_settings .inline-drawer-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.my_example_extension_settings label {
    font-weight: bold;
    margin-top: 4px;
}
```

---

## Common Mistakes to Avoid

### 1. Using the old Extras API
**Wrong:** Importing from `extensions.js` and using `doExtrasFetch()` or `getApiUrl()`
**Right:** Use `SillyTavern.getContext()` APIs. Extras was discontinued in April 2024.

### 2. Caching context references
**Wrong:**
```javascript
const metadata = SillyTavern.getContext().chatMetadata; // Stale after chat switch!
```
**Right:**
```javascript
// Always get fresh reference
SillyTavern.getContext().chatMetadata['key'] = 'value';
```

### 3. Using `require()` or Node.js APIs in UI extensions
UI extensions run in the **browser**, not Node.js. You cannot use `require()`, `fs`, `path`, etc. Use `import` statements or fetch APIs instead.

### 4. Wrong import paths
**Wrong:**
```javascript
import { something } from '../script.js';  // Wrong relative path
import { something } from 'script.js';     // No path resolution
```
**Right:**
```javascript
import { something } from '../../../../script.js'; // Correct: 4 levels up from third-party/ext/
```

### 5. Not using a unique MODULE_NAME
**Wrong:** `const MODULE_NAME = 'settings';` — will conflict with other extensions.
**Right:** `const MODULE_NAME = 'my_unique_extension_name';`

### 6. Storing secrets in extensionSettings
**Wrong:** `extensionSettings[MODULE_NAME].apiKey = 'sk-...'`
**Right:** Use a server plugin for sensitive data handling.

### 7. Not handling undefined characterId
**Wrong:**
```javascript
const char = context.characters[context.characterId]; // Crashes in group chats!
```
**Right:**
```javascript
const { characterId, characters } = SillyTavern.getContext();
if (characterId !== undefined) {
    const char = characters[characterId];
}
```

### 8. Forgetting to save settings
**Wrong:** Modifying `extensionSettings` without calling `saveSettingsDebounced()`
**Right:** Always call `saveSettingsDebounced()` after modifying settings.

### 9. Using the legacy `registerSlashCommand` for new extensions
**Wrong:** Using the old `registerSlashCommand(name, callback, aliases, helpString)` format
**Right:** Use `SlashCommandParser.addCommandObject(SlashCommand.fromProps({...}))` for full autocomplete and help support.

### 10. Not handling async properly
**Wrong:**
```javascript
eventSource.on(event_types.MESSAGE_RECEIVED, async (data) => {
    const result = generateQuietPrompt({...}); // Missing await!
});
```
**Right:**
```javascript
eventSource.on(event_types.MESSAGE_RECEIVED, async (data) => {
    const result = await generateQuietPrompt({...});
});
```

---

## Reference Links

- **Official Extension Docs:** https://docs.sillytavern.app/for-contributors/writing-extensions/
- **Function Calling Docs:** https://docs.sillytavern.app/for-contributors/function-calling/
- **Server Plugins Docs:** https://docs.sillytavern.app/for-contributors/server-plugins/
- **Example Extension:** https://github.com/city-unit/st-extension-example
- **Webpack Template:** https://github.com/SillyTavern/Extension-WebpackTemplate
- **React Template:** https://github.com/SillyTavern/Extension-ReactTemplate
- **Official Extensions List:** https://github.com/search?q=topic:extension+org:SillyTavern&type=Repositories
- **getContext() Source:** https://github.com/SillyTavern/SillyTavern/blob/staging/public/scripts/st-context.js
- **Event Types Source:** https://github.com/SillyTavern/SillyTavern/blob/staging/public/scripts/events.js
- **Shared Libraries Source:** https://github.com/SillyTavern/SillyTavern/blob/release/public/lib.js
