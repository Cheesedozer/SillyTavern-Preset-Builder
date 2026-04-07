/**
 * Preset Builder — Main entry point.
 * Handles initialization, tab routing, shared state, and settings management.
 */

import { initDescribeTab } from './describe.js';

const MODULE_NAME = 'preset_builder';
const EXTENSION_FOLDER = import.meta.url.match(/\/scripts\/extensions\/(.+)\/index\.js/)?.[1] || 'third-party/SillyTavern-Preset-Builder';
const EXTENSION_PATH = `scripts/extensions/${EXTENSION_FOLDER}`;

const defaultSettings = Object.freeze({
    enabled: true,
    lastDescription: '',
    selfAuditEnabled: true,
    defaultModel: '',
});

/**
 * Get the extension settings, initializing defaults if needed.
 * @returns {object}
 */
export function getSettings() {
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
 * Save settings (debounced).
 */
export function saveSettings() {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    saveSettingsDebounced();
}

/**
 * Initialize tab routing.
 */
function initTabs() {
    $(document).on('click', '.pb-tab-bar .pb-tab', function () {
        const tab = $(this).data('tab');

        // Update tab bar active state
        $(this).siblings('.pb-tab').removeClass('active');
        $(this).addClass('active');

        // Update tab content visibility
        const $parent = $(this).closest('.preset-builder-settings');
        $parent.find('.pb-tab-content').removeClass('active');
        $parent.find(`.pb-tab-content[data-tab="${tab}"]`).addClass('active');
    });
}

/**
 * Main initialization — called when the extension loads.
 */
(async function init() {
    // Load HTML template
    const html = await $.get(`/${EXTENSION_PATH}/settings.html`);
    $('#extensions_settings2').append(html);

    // Initialize settings
    getSettings();

    // Initialize tab routing
    initTabs();

    // Initialize the Describe tab
    initDescribeTab();

    console.log('[PresetBuilder] Extension loaded.');
})();
