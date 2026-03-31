/**
 * FILE: dom.js
 * PROCESS: Renderer
 * ROLE: Single source of truth for all cached DOM element references.
 *       cacheDOMElements() is called once on startup. All other modules
 *       import { dom } and read from it — never call document.getElementById()
 *       themselves. This prevents scattered DOM queries and makes refactoring easier.
 *
 * DEPENDENCIES: none
 *
 * EXPORTS:
 *   - dom: Shared mutable object — properties are set by cacheDOMElements()
 *   - cacheDOMElements(): Populates dom with all element references
 *
 * DOCS:
 *   - docs/architecture/overview.md → Module Responsibilities (ui/dom.js)
 */

// The shared dom object — starts empty, populated by cacheDOMElements().
// All modules import this object and read its properties directly.
export const dom = {};

/**
 * FUNCTION: cacheDOMElements
 * PURPOSE: Queries and caches all DOM element references at app startup.
 *          Called once by renderer.js before any other module needs the DOM.
 *          After this runs, all dom.* properties are safe to access throughout
 *          the app's lifecycle.
 *
 * SIDE EFFECTS:
 *   - Populates the exported dom object with element references
 *
 * CALLED BY: renderer.js (first call in DOMContentLoaded handler)
 */
export function cacheDOMElements() {
    // ── API Controls ──────────────────────────────────────────────────────────
    // The clan tag input and the fetch/refresh/import button
    dom.clanTagInput = document.getElementById('clanTagInput');
    dom.fetchDataBtn = document.getElementById('fetchDataBtn');

    // ── Main Tables ───────────────────────────────────────────────────────────
    // Table bodies for the players roster and the bonus/rankings table
    dom.playersBody = document.getElementById('playersBody');
    dom.rankingsBody = document.getElementById('rankingsBody');

    // ── Action Buttons ────────────────────────────────────────────────────────
    dom.resetDataBtn = document.getElementById('resetDataBtn');   // Opens confirmation modal → resets all data
    dom.exportDataBtn = document.getElementById('exportDataBtn'); // Triggers JSON export via IPC
    dom.importDataBtn = document.getElementById('importDataBtn'); // Triggers JSON import via file dialog

    // ── CWL Status Controls ───────────────────────────────────────────────────
    // Manual override controls shown when CWL data is not available from the API
    dom.cwlFinishedCheckbox = document.getElementById('cwlFinishedCheckbox'); // Toggle: season ended?
    dom.warsWonSelect = document.getElementById('warsWonSelect');             // Manual wars won count
    dom.warsWonContainer = document.getElementById('warsWonContainer');       // Wrapper for warsWonSelect
    dom.leagueSelect = document.getElementById('leagueSelect');               // League tier selector
    dom.bonusHeaderTh = document.getElementById('bonusHeaderTh');             // "Bonus" column header (hidden when not finished)
    dom.bonusCountDisplay = document.getElementById('bonusCountDisplay');     // Bonus count number display

    // ── Clan Identity Bar ─────────────────────────────────────────────────────
    // Displays the clan badge, name, and league pill after a successful fetch
    dom.clanIdentityDisplay = document.getElementById('clanIdentityDisplay');

    // ── Settings Sidebar ──────────────────────────────────────────────────────
    dom.decimalPlacesSelect = document.getElementById('decimalPlacesSelect'); // Score decimal places
    dom.bestAttacksSelect = document.getElementById('bestAttacksSelect');     // Best N attacks to average
    dom.autoRefreshSelect = document.getElementById('autoRefreshSelect');     // Auto-refresh interval (minutes)

    // Filter toggles (added in v1.1.0)
    dom.hideNonCwlCheckbox = document.getElementById('hideNonCwlCheckbox'); // Hide non-CWL-rostered members
    dom.hideBenchCheckbox = document.getElementById('hideBenchCheckbox');   // Hide players with 0 participations

    // ── Main Layout ───────────────────────────────────────────────────────────
    dom.emptyStateContainer = document.getElementById('emptyStateContainer');   // Shown when no players loaded
    dom.playerRosterContainer = document.getElementById('playerRosterContainer'); // Shown when players exist
    dom.rankingsSection = document.getElementById('rankingsSection');           // Bonus/rankings table section
    dom.rosterControlsWrapper = document.querySelector('.roster-controls-wrapper'); // Add/filter controls above table

    // ── Modals ────────────────────────────────────────────────────────────────
    // The confirmation modal is a static DOM element (always present, toggled with .hidden)
    dom.confirmationModal = document.getElementById('confirmationModal');
    dom.confirmModalMessage = document.getElementById('confirmModalMessage'); // Text inside the modal
    dom.confirmBtn = document.getElementById('confirmBtn');   // "Confirm" button
    dom.cancelBtn = document.getElementById('cancelBtn');     // "Cancel" button

    // ── Shared UI Elements ────────────────────────────────────────────────────
    dom.tooltip = document.getElementById('tooltip');             // Global floating tooltip element
    dom.parchmentContainer = document.getElementById('parchmentContainer'); // Main layout wrapper
    dom.sidebarToggleBtn = document.getElementById('sidebarToggleBtn');     // Collapse/expand sidebar

    // ── War Day Controls ──────────────────────────────────────────────────────
    // The war day selector buttons are rendered dynamically by main_view.js
    dom.warDaySelectorContainer = document.getElementById('warDaySelectorContainer');
    dom.format15v15Radio = document.getElementById('format15v15'); // 15v15 radio button (default)
    // activeDayControlContainer is no longer used in the UI (removed in v1.1.0 refactor)
}