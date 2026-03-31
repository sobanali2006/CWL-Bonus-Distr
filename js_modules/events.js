/**
 * FILE: events.js
 * PROCESS: Renderer
 * ROLE: Owns all DOM event listener setup and the auto-refresh timer.
 *       Translates user interactions into state mutations by calling state.js
 *       functions. Does not contain business logic — delegates everything.
 *
 * DEPENDENCIES:
 *   - state.js:               All state mutation functions + processApiData
 *   - ui/components.js:       showConfirmationModal, closeModal, showToast
 *   - ui/dom.js:              dom — cached DOM refs
 *   - ui/modal_lineup_editor.js: openLineupEditor — called from war day buttons
 *
 * EXPORTS:
 *   - updateFetchButtonState(): Syncs fetch button label/state to current input
 *   - triggerStartupFetch():    Auto-fetch on app startup if a saved tag exists
 *   - setupAutoRefresh(minutes): Start/restart the auto-refresh interval timer
 *   - attachInitialEventListeners(): Wire all DOM event listeners (called once on startup)
 *   - applySettingsUI():        Sync settings controls to current appSettings values
 *
 * DOCS:
 *   - docs/architecture/data-flow.md → Flow 1 (handleApiFetch), Flow 4 (auto-refresh)
 */

import { getState, updateSetting, setWarFormat, resetAllData, exportData, importData, setCwlFinished, setWarsWon, setCwlLeague, setActiveDayForNav, processApiData, getSavedClanTag, saveAppState } from './state.js';
import { showConfirmationModal, closeModal, showToast } from './ui/components.js';
import { dom } from './ui/dom.js';
import { openLineupEditor } from './ui/modal_lineup_editor.js';

// ── AUTO-REFRESH TIMER ────────────────────────────────────────────────────────
// Holds the setInterval handle for the auto-refresh feature.
// Must be module-scoped so setupAutoRefresh() can clear the previous timer
// before setting a new one — prevents multiple overlapping intervals.
let refreshTimer = null;

// ── FETCH BUTTON STATE ────────────────────────────────────────────────────────

/**
 * FUNCTION: updateFetchButtonState
 * PURPOSE: Keeps the fetch button's label and state in sync with the clan tag
 *          input and the last-fetched tag. The button has three states:
 *
 *   1. DISABLED "Import Data" — input is too short (< 2 chars)
 *   2. ENABLED  "Import Data" (blue) — input differs from saved tag → new clan
 *   3. ENABLED  "Refresh Data" (green) — input matches saved tag → same clan refresh
 *
 * SIDE EFFECTS:
 *   - Mutates dom.fetchDataBtn.textContent, className, disabled
 *
 * CALLED BY:
 *   - events.js → clanTagInput 'input' listener
 *   - events.js → handleApiFetch() (after fetch completes)
 *   - state.js  → resetAllData()
 */
export function updateFetchButtonState() {
    const currentInput = dom.clanTagInput.value.trim().toUpperCase();
    const savedTag = getSavedClanTag();

    if (currentInput.length < 2) {
        // Input too short — disable button with neutral label
        dom.fetchDataBtn.textContent = 'Import Data';
        dom.fetchDataBtn.className = 'btn btn-primary';
        dom.fetchDataBtn.disabled = true;
        return;
    }

    dom.fetchDataBtn.disabled = false;

    if (savedTag && currentInput === savedTag) {
        // Same tag as last fetch → this will be a background refresh (green)
        dom.fetchDataBtn.textContent = 'Refresh Data';
        dom.fetchDataBtn.className = 'btn btn-success';
    } else {
        // Different or new tag → this will import a new clan (blue)
        dom.fetchDataBtn.textContent = 'Import Data';
        dom.fetchDataBtn.className = 'btn btn-primary';
    }
}

/**
 * FUNCTION: triggerStartupFetch
 * PURPOSE: Runs a background API fetch automatically when the app starts,
 *          if a saved clan tag exists. Keeps the data fresh without user action.
 *
 * SIDE EFFECTS:
 *   - Calls handleApiFetch(true) — silent background fetch (no "Fetching..." toast)
 *
 * CALLED BY: renderer.js (during DOMContentLoaded initialization, after loadInitialData)
 */
export async function triggerStartupFetch() {
    const savedTag = getSavedClanTag();
    if (savedTag) {
        await handleApiFetch(true); // isBackground=true → silent toast
    }
}

// ── AUTO-REFRESH ──────────────────────────────────────────────────────────────

/**
 * FUNCTION: setupAutoRefresh
 * PURPOSE: Starts (or restarts) the auto-refresh interval timer.
 *          Always clears the existing timer first to prevent multiple intervals
 *          from stacking up if the user changes the refresh setting multiple times.
 *
 * @param minutes - Refresh interval in minutes. 0 = disable auto-refresh
 *                  (only fetch on startup). Positive values enable periodic refresh.
 *
 * SIDE EFFECTS:
 *   - Clears the existing refreshTimer (if any)
 *   - Sets a new setInterval → calls handleApiFetch(true) every N minutes
 *     only if clanTagInput has a value (skip if user cleared the field)
 *
 * CALLED BY:
 *   - events.js → autoRefreshSelect 'change' listener
 *   - events.js → applySettingsUI() (on startup, to restore saved interval)
 */
export function setupAutoRefresh(minutes) {
    // Always clear the existing timer before creating a new one.
    // Without this, changing the interval would stack multiple setIntervals.
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    if (minutes <= 0) {
        console.log("Auto-Refresh: Only on Startup");
        return; // Timer disabled — only startup fetch will happen
    }

    console.log(`Auto-Refresh enabled: Every ${minutes} minutes.`);
    refreshTimer = setInterval(() => {
        // Only auto-refresh if a clan tag is entered (guard against empty input)
        if (dom.clanTagInput.value.length > 2) {
            handleApiFetch(true); // isBackground=true → shows quiet update toast
        }
    }, minutes * 60000); // Convert minutes to milliseconds
}

// ── EVENT LISTENER SETUP ──────────────────────────────────────────────────────

/**
 * FUNCTION: attachInitialEventListeners
 * PURPOSE: Wires all DOM event listeners for the app. Called exactly once on
 *          startup from renderer.js. After this, the UI is fully interactive.
 *
 * SIDE EFFECTS:
 *   - Attaches click/change/input/keydown listeners to all interactive DOM elements
 *   - Attaches global keydown listener for Escape key modal dismissal
 *
 * CALLED BY: renderer.js (during DOMContentLoaded initialization)
 */
export function attachInitialEventListeners() {
    // Primary action button: fetch clan data from API
    dom.fetchDataBtn.addEventListener('click', () => handleApiFetch(false));

    // Clan tag input: auto-format to uppercase with # prefix, update button state
    dom.clanTagInput.addEventListener('input', (e) => {
        let value = e.target.value.toUpperCase();
        // Ensure tag always starts with # (strip any accidental duplicates)
        if (value.length > 0 && !value.startsWith('#')) {
            value = '#' + value.replace(/#/g, '');
        }
        e.target.value = value;
        updateFetchButtonState();
    });

    // War format radio buttons (15v15 or 30v30)
    document.querySelectorAll('input[name="warFormat"]').forEach(radio => radio.addEventListener('change', (e) => setWarFormat(Number(e.target.value))));

    // Reset button: requires confirmation modal before wiping all data
    dom.resetDataBtn.addEventListener('click', () => showConfirmationModal('Are you absolutely sure you want to delete ALL data? This action cannot be undone!', resetAllData));

    // Data export/import buttons
    dom.exportDataBtn.addEventListener('click', exportData);
    dom.importDataBtn.addEventListener('click', importData);

    // Settings controls: each triggers updateSetting() with the new value
    dom.decimalPlacesSelect.addEventListener('change', (e) => updateSetting('decimals', Number(e.target.value)));
    dom.bestAttacksSelect.addEventListener('change', (e) => updateSetting('bestAttacksToAverage', Number(e.target.value)));

    // Auto-refresh select: also restarts the timer with the new interval
    dom.autoRefreshSelect.addEventListener('change', (e) => {
        const minutes = Number(e.target.value);
        updateSetting('autoRefreshInterval', minutes);
        setupAutoRefresh(minutes); // Restart timer with new interval
    });

    // Filter toggles: hide non-CWL members or benched players from the table
    dom.hideNonCwlCheckbox.addEventListener('change', (e) => updateSetting('hideNonCwl', e.target.checked));
    dom.hideBenchCheckbox.addEventListener('change', (e) => updateSetting('hideBench', e.target.checked));

    // Sidebar toggle: collapse/expand the settings panel
    dom.sidebarToggleBtn.addEventListener('click', () => {
        dom.parchmentContainer.classList.toggle('sidebar-collapsed');
    });

    // Manual override controls for CWL status (shown when cwlFinished is false)
    dom.cwlFinishedCheckbox.addEventListener('change', (e) => setCwlFinished(e.target.checked));
    dom.warsWonSelect.addEventListener('change', (e) => setWarsWon(Number(e.target.value)));
    dom.leagueSelect.addEventListener('change', (e) => setCwlLeague(e.target.value));

    // War day selector buttons (dynamically rendered by main_view.js)
    // Uses event delegation on the container to handle dynamically added buttons
    dom.warDaySelectorContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('war-day-btn')) {
            const dayIndex = Number(e.target.dataset.dayIndex);
            openLineupEditor(dayIndex); // Open the war day lineup viewer modal
        }
    });

    // Global Escape key handler: closes the topmost visible modal
    document.addEventListener('keydown', handleGlobalKeydown);
}

// ── API FETCH ORCHESTRATION ───────────────────────────────────────────────────

/**
 * FUNCTION: handleApiFetch
 * PURPOSE: Orchestrates a full API fetch cycle: validates input, shows feedback,
 *          calls the IPC bridge, passes result to processApiData(), updates UI.
 *
 * @param isBackground - If true, shows a quieter toast ("Updating..." vs "Fetching...").
 *                       Used by auto-refresh and startup fetch to avoid intrusive toasts.
 *
 * SIDE EFFECTS:
 *   - Disables fetch button during request (re-enables after)
 *   - Calls window.api.fetchClanData() → main.js IPC handler
 *   - Calls state.js → processApiData() on success
 *   - Calls saveAppState() and updateFetchButtonState() after completion
 *   - Shows success or error toast
 *
 * CALLED BY:
 *   - events.js → fetchDataBtn click listener (isBackground=false)
 *   - events.js → setupAutoRefresh() setInterval (isBackground=true)
 *   - events.js → triggerStartupFetch() (isBackground=true)
 */
async function handleApiFetch(isBackground = false) {
    const clanTag = dom.clanTagInput.value.trim();
    if (!clanTag || clanTag.length < 2) {
        showToast('Please enter a valid Clan Tag.', 'error');
        return;
    }

    const savedTag = getSavedClanTag();
    // Detect whether this is a new clan import or a refresh of the same clan
    const isImport = (!savedTag || savedTag !== clanTag);

    // Show appropriate loading state to the user
    if (isImport) {
        showToast('Fetching clan data...', 'info', true); // persistent=true: stays until done
    } else {
        showToast('Updating data...', 'info', true);
    }

    dom.fetchDataBtn.disabled = true; // Prevent double-click during fetch

    const result = await window.api.fetchClanData(clanTag);

    if (result.success) {
        console.log("--- RAW DATA RECEIVED BY FRONTEND ---", result.data);
        processApiData(result.data); // Process and re-render (saves internally)

        saveAppState(); // Belt-and-suspenders: ensure clan tag is persisted
        updateFetchButtonState(); // Refresh button now shows "Refresh Data" in green

        if (isImport) {
            showToast('Fetched clan data successfully!', 'success');
        } else {
            showToast('Updated clan data successfully!', 'success');
        }

    } else {
        showToast(`Error: ${result.error}`, 'error');
    }

    dom.fetchDataBtn.disabled = false;
    updateFetchButtonState(); // Final sync in case savedTag changed during fetch
}

// ── GLOBAL KEY HANDLER ────────────────────────────────────────────────────────

/**
 * FUNCTION: handleGlobalKeydown
 * PURPOSE: Handles Escape key presses globally to dismiss the topmost visible modal.
 *          Traverses the modal stack (all visible .modal-bg elements) and triggers
 *          the appropriate close action for the topmost one.
 *
 * @param event - KeyboardEvent from the 'keydown' listener
 *
 * MODAL STACK LOGIC:
 *   - Queries all visible modals (.modal-bg:not(.hidden))
 *   - Takes the LAST one in DOM order (visually on top)
 *   - For lineupChangesModal: clicks the cancel button (to handle unsaved changes)
 *   - For dynamic modals (#closeBtn, #modalCloseBtn): clicks their close button
 *   - For confirmationModal: clicks the cancel button
 *
 * CALLED BY: document 'keydown' listener (attached in attachInitialEventListeners)
 */
function handleGlobalKeydown(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal-bg:not(.hidden)');
        if (modals.length > 0) {
            // Get the topmost visible modal (last in DOM = on top visually)
            const topModal = modals[modals.length - 1];

            // lineupChangesModal has its own cancel logic (handles unsaved changes warning)
            if (topModal.id === 'lineupChangesModal') {
                const cancelBtn = topModal.querySelector('#changesCancelBtn');
                cancelBtn?.click();
                return;
            }

            // Dynamic modals (attackEditorModal, lineupEditorModal) have a generic close button
            const dynamicCloseBtn = topModal.querySelector('#closeBtn, #modalCloseBtn');
            if (dynamicCloseBtn) {
                dynamicCloseBtn.click();
            }
            // Static confirmation modal uses a dedicated cancel button
            else if (topModal.id === 'confirmationModal') {
                const confirmCancelBtn = topModal.querySelector('#cancelBtn');
                confirmCancelBtn?.click();
            }
        }
    }
}

// ── SETTINGS UI SYNC ─────────────────────────────────────────────────────────

/**
 * FUNCTION: applySettingsUI
 * PURPOSE: Syncs all settings sidebar controls to the current appSettings values.
 *          Called whenever settings change (on load, on import, after updateSetting)
 *          to ensure UI controls always reflect the actual settings state.
 *
 * SIDE EFFECTS:
 *   - Updates DOM values for all settings controls
 *   - Also calls setupAutoRefresh() to ensure the timer reflects restored settings
 *   - Updates tooltip text for the Average Performance Score column header
 *
 * CALLED BY:
 *   - state.js → loadSettings(), updateSetting()
 */
export function applySettingsUI() {
    const { appSettings } = getState();
    dom.decimalPlacesSelect.value = appSettings.decimals;
    dom.bestAttacksSelect.value = appSettings.bestAttacksToAverage;

    if (dom.autoRefreshSelect) {
        dom.autoRefreshSelect.value = appSettings.autoRefreshInterval || 0;
        // Restart the timer to reflect the restored interval (important on app startup)
        setupAutoRefresh(appSettings.autoRefreshInterval || 0);
    }

    // Sync filter toggle checkboxes to saved settings
    if (dom.hideNonCwlCheckbox) {
        dom.hideNonCwlCheckbox.checked = appSettings.hideNonCwl || false;
    }
    if (dom.hideBenchCheckbox) {
        dom.hideBenchCheckbox.checked = appSettings.hideBench || false;
    }

    // Update the tooltip on the "Average Performance Score" column header
    // to reflect the actual N value used in the "Best N of M" average setting
    const tooltipText = "Mean of the player's attacks, based on the number selected in settings.";
    document.querySelectorAll('th[data-tooltip="Average Performance Score"]').forEach(header => {
        header.dataset.tooltip = tooltipText;
    });
}