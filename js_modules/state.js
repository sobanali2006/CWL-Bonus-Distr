/**
 * FILE: state.js
 * PROCESS: Renderer
 * ROLE: Single source of truth for all application state. Owns all state
 *       variables, the main computation pipeline (computeAll), and all
 *       persistence operations (saveAppState, loadInitialData).
 *       UI rendering is delegated to ui/main_view.js — state.js never directly
 *       manipulates the DOM except through those render functions.
 *
 * DEPENDENCIES:
 *   - config.js:          LEAGUES array, config constants, localStorage keys
 *   - calculator.js:      calculatePerformanceScore() — used in computeAll()
 *   - ui/main_view.js:    updateUIVisibility(), renderPlayersTable(), renderRankingsTable()
 *   - ui/components.js:   showToast() — user feedback notifications
 *   - events.js:          applySettingsUI(), updateFetchButtonState()
 *   - ui/dom.js:          dom — cached DOM refs for direct-access updates (clan tag, war format)
 *
 * EXPORTS:
 *   - getState()                                → snapshot of all state variables
 *   - getSavedClanTag()                         → last fetched clan tag
 *   - saveAppState()                            → persist current state to localStorage
 *   - computeAll()                              → full recompute + re-render pipeline
 *   - loadInitialData()                         → restore state from localStorage on startup
 *   - loadSettings()                            → restore and apply appSettings
 *   - updateSetting(key, value)                 → mutate one setting + recompute
 *   - setWarFormat(newFormat)                   → change 15v15/30v30 + recompute
 *   - setActiveDayForNav(dayIndex)              → change war day view + recompute
 *   - addPlayer()                               → add empty player row
 *   - deletePlayer(originalPlayerIndex)         → remove player by index
 *   - resetAllData()                            → wipe all state + localStorage
 *   - setCwlFinished(isFinished)                → manual override for CWL finished flag
 *   - setWarsWon(count)                         → manual override for wars won count
 *   - setCwlLeague(leagueId)                    → change selected league
 *   - exportData()                              → serialize + trigger file save via IPC
 *   - importData()                              → trigger file open via IPC + restore state
 *   - handleSaveLineup(dayIndex, lineup)        → save lineup changes from modal
 *   - processApiData(apiData)                   → process fresh API response into state
 *
 * DOCS:
 *   - docs/architecture/data-flow.md  → Full flow diagrams
 *   - docs/architecture/decisions.md  → ADR-002 (no stored computed scores)
 *                                     → ADR-003 (data freeze safeguard)
 */

import { config, LEAGUES } from './config.js';
import { calculatePerformanceScore } from './calculator.js';
import { updateUIVisibility, renderPlayersTable, renderRankingsTable } from './ui/main_view.js';
import { showToast } from './ui/components.js';
import { applySettingsUI, updateFetchButtonState } from './events.js';
import { dom } from './ui/dom.js';

// ── STATE VARIABLES ───────────────────────────────────────────────────────────

// Full player roster. Each player: { id, name, th, clanRank, isCwlMember,
// wars[0..6], isBonusGiven, __computed (temp — never saved, see ADR-002) }
let players = [];

// Raw war data from API for all 7 days. cwlWarDetails[i] = war object for day i,
// or null if that round hasn't been fetched yet or didn't include our clan.
let cwlWarDetails = [];

// Auto-calculated in computeAll(). True when all 7 wars have started (or ended).
// Triggers the season summary card UI and bonus checkbox display in rankings table.
let cwlFinished = false;

// Auto-calculated in computeAll(). Count of wars the clan has won this season.
// A "win" = more stars than opponent, or equal stars with higher destruction %.
let warsWon = 0;

// Auto-calculated in computeAll(). Total bonus medals available = leagueBase + warsWon.
let bonusCount = 0;

// ID of the league the clan is competing in this CWL season (e.g., 'master1').
// Defaults to crystal1 (index 6) if none is set.
let cwlLeague = LEAGUES[6].id;

// User-configurable settings. Persisted to localStorage under settingsStorageKey.
let appSettings = {
    decimals: 3,              // Decimal places shown in score displays
    bestAttacksToAverage: 6,  // Best N scores used for average performance calculation
    autoRefreshInterval: 0,   // Auto-refresh period in minutes (0 = only on startup)
    hideNonCwl: false,        // If true, players not in CWL roster are hidden from table
    hideBench: false          // If true, benched players (0 participations) are hidden
};

// The war day currently shown in the players table — -1 means "overview" (all wars).
let activeDayForNav = -1;

// Index (0-6) of the war that is currently "inWar" according to the API.
// -1 if no war is currently live. Set by processApiData().
let currentLiveDayIndex = -1;

// The last clan tag that was successfully fetched. Used to detect if a new fetch
// is for a different clan (import) vs. the same clan (refresh).
let savedClanTag = '';

// Clan metadata from the API: { name, badgeUrl, leagueName }.
// Null until the first successful API fetch. Persisted to 'cwl_clan_meta'.
let clanMeta = null;

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

/**
 * FUNCTION: sortPlayersForActiveDay
 * PURPOSE: Reorders the players array based on the currently active war day.
 *          When viewing a specific war day, players in the lineup appear first
 *          (sorted by map position), followed by substitutes alphabetically.
 *          When in overview mode (activeDayForNav === -1), players are sorted
 *          by their official clan rank.
 *
 * SIDE EFFECTS:
 *   - Mutates the players array in place (reorders elements)
 *
 * CALLED BY: state.js → computeAll(), setActiveDayForNav(), loadInitialData()
 */
function sortPlayersForActiveDay() {
    if (activeDayForNav === -1) {
        // Overview mode: sort by clan rank (position in the clan rooster)
        players.sort((a, b) => (a.clanRank || 0) - (b.clanRank || 0));
        return;
    }
    // War day view: separate lineup players from substitutes, then merge
    const lineup = [];
    const substitutes = [];
    players.forEach(player => {
        const warData = player.wars[activeDayForNav];
        if (warData && warData.myPosition > 0) {
            lineup.push({ player, position: warData.myPosition });
        } else {
            substitutes.push(player);
        }
    });
    lineup.sort((a, b) => a.position - b.position);
    players = [...lineup.map(item => item.player), ...substitutes];
}

// ── PUBLIC STATE ACCESSORS ─────────────────────────────────────────────────────

/**
 * FUNCTION: getState
 * PURPOSE: Returns a snapshot of all current state variables. Other modules
 *          call this to read state without directly importing the let variables.
 *          Note: this returns the actual objects (not deep copies), so callers
 *          should not mutate returned values.
 *
 * @returns {object} Current state snapshot
 *
 * CALLED BY: calculator.js, events.js, ui/main_view.js, ui/modal_*.js,
 *            ui/dom.js, renderer.js
 */
export function getState() {
    return { players, cwlWarDetails, cwlFinished, warsWon, bonusCount, cwlLeague, warFormat: config.warFormat, appSettings, activeDayForNav, currentLiveDayIndex, clanMeta };
}

/**
 * FUNCTION: getSavedClanTag
 * PURPOSE: Returns the clan tag of the last successful API fetch. Used by
 *          events.js to determine if an incoming fetch is a "refresh" (same tag)
 *          or an "import" (new tag).
 *
 * @returns {string} savedClanTag — empty string if no fetch has happened yet
 *
 * CALLED BY: events.js → handleApiFetch(), updateFetchButtonState()
 */
export function getSavedClanTag() {
    return savedClanTag;
}

// ── PERSISTENCE ───────────────────────────────────────────────────────────────

/**
 * FUNCTION: saveAppState
 * PURPOSE: Persists all current state to localStorage. __computed is never
 *          saved — it's always recalculated fresh on next load (see ADR-002).
 *          Called after every state mutation that should survive a restart.
 *
 * SIDE EFFECTS:
 *   - Writes to multiple localStorage keys (see docs/architecture/data-flow.md → Key Map)
 *   - Reads dom.clanTagInput.value to update savedClanTag
 *
 * CALLED BY: Nearly all state-mutating functions (computeAll delegates to callers)
 */
export function saveAppState() {
    // Players array: __computed is stripped implicitly because we never add it to localStorage
    localStorage.setItem(config.localStorageKey, JSON.stringify(players));
    // Raw war data from API (all 7 days)
    localStorage.setItem('cwl_war_details', JSON.stringify(cwlWarDetails));
    // User settings (decimals, best attacks, auto-refresh, hide toggles)
    localStorage.setItem(config.settingsStorageKey, JSON.stringify(appSettings));
    // Derived values: warsWon and cwlFinished are recalculated on load,
    // but storing them provides faster initial render before computeAll() runs
    localStorage.setItem(config.cwlLeagueKey, cwlLeague);
    localStorage.setItem(config.warFormatKey, config.warFormat.toString());
    localStorage.setItem('cwl_live_day_index', currentLiveDayIndex.toString());

    // Clan meta (name, badge URL, league name) — for identity display on startup
    if (clanMeta) {
        localStorage.setItem('cwl_clan_meta', JSON.stringify(clanMeta));
    }

    // Persist the current clan tag input and sync savedClanTag
    if (dom.clanTagInput && dom.clanTagInput.value) {
        localStorage.setItem('cwl_clan_tag', dom.clanTagInput.value);
        savedClanTag = dom.clanTagInput.value;
    }
}

// ── COMPUTATION PIPELINE ──────────────────────────────────────────────────────

/**
 * FUNCTION: computeAll
 * PURPOSE: The master recomputation function. Recalculates all derived values
 *          from raw state and then triggers a full UI re-render. Called after
 *          every state change.
 *
 * SIDE EFFECTS:
 *   - Mutates warsWon, cwlFinished, bonusCount, cwlLeague (derived from state)
 *   - Mutates each player's player.__computed object (temp scores)
 *   - Calls updateUIVisibility() — shows/hides major sections
 *   - Calls renderPlayersTable() — rebuilds the players table
 *   - Calls renderRankingsTable() — rebuilds the rankings table
 *
 * CALLED BY: Virtually every state-mutating function after it finishes.
 *
 * SEE ALSO: docs/architecture/data-flow.md → Flow 1: computeAll section
 */
export function computeAll() {
    updateUIVisibility();
    sortPlayersForActiveDay();

    // ─── PHASE 1: AUTO-CALCULATE WARS WON + SEASON STATUS ───────────────────
    // Iterate over warDetails to count wars started and wars won.
    // Win condition: more stars than opponent, OR equal stars + higher destruction %.
    let warsStarted = 0;
    let wins = 0;

    if (cwlWarDetails && cwlWarDetails.length > 0) {
        cwlWarDetails.forEach(war => {
            if (war && (war.state === 'inWar' || war.state === 'warEnded')) {
                warsStarted++;
                if (war.state === 'warEnded') {
                    if (war.clan.stars > war.opponent.stars) {
                        wins++;
                    } else if (war.clan.stars === war.opponent.stars) {
                        // Tiebreaker: higher destruction % wins
                        if (war.clan.destructionPercentage > war.opponent.destructionPercentage) {
                            wins++;
                        }
                    }
                }
            }
        });
    }

    warsWon = wins;
    // CWL is "finished" when all 7 wars have at least started — this triggers
    // the season summary card and enables bonus checkboxes in the rankings table
    cwlFinished = (warsStarted === 7);

    // ─── PHASE 2: AUTO-CALCULATE BONUS COUNT ─────────────────────────────────
    // bonusCount = leagueBase + warsWon
    // The league base is looked up from LEAGUES config. If we have the league name
    // from the API (clanMeta.leagueName), we try to match it directly; otherwise
    // fall back to the manually-stored cwlLeague ID.
    let leagueBase = 0;
    if (clanMeta && clanMeta.leagueName) {
        // Prefer API league name (auto-set from fetch) over manually chosen ID
        const foundLeague = LEAGUES.find(l => l.name === clanMeta.leagueName);
        if (foundLeague) {
            cwlLeague = foundLeague.id; // Keep internal ID in sync with API data
            leagueBase = foundLeague.base;
        } else {
            // API league name didn't match any config entry — fall back to stored ID
            const stored = LEAGUES.find(l => l.id === cwlLeague);
            if(stored) leagueBase = stored.base;
        }
    } else {
        // No clanMeta available — use whatever league was manually selected
        const stored = LEAGUES.find(l => l.id === cwlLeague);
        if(stored) leagueBase = stored.base;
    }

    bonusCount = leagueBase + warsWon;

    // ─── PHASE 3: CALCULATE PERFORMANCE SCORES FOR ALL PLAYERS ───────────────
    // For each player, compute per-war scores and aggregate stats.
    // __computed is a temporary object rebuilt fresh on every computeAll() call
    // — see ADR-002. It is never persisted to localStorage.
    players.forEach(p => {
        p.__computed = p.__computed || {};
        p.__computed.warScores = []; // Fresh score array each run
        let participations = 0;
        let totalStars = 0;
        let scorableEventsCount = 0; // Total events that factor into the average divisor

        for (let i = 0; i < 7; i++) {
            // Only score wars that have actually started (up to warsStarted)
            if (i >= warsStarted) continue;

            const war = p.wars[i];

            if (war.myPosition > 0) {
                // Player was in the lineup for this war day
                if (war.status === 'attacked' || war.status === 'missed') {
                    participations++;
                    scorableEventsCount++; // This war day counts toward the divisor
                    const score = calculatePerformanceScore(p, war);
                    p.__computed.warScores.push(score !== null ? score : 0);
                    if (war.status === 'attacked') totalStars += (war.stars || 0);
                }
                // Pending (in lineup, war live, hasn't attacked yet) — not counted
            } else {
                // Player was benched — counts as a scorable event with 0 points
                // Ensures benched wars penalize the average rather than being ignored
                scorableEventsCount++;
                p.__computed.warScores.push(0);
            }
        }

        p.__computed.participations = participations;
        p.__computed.totalStars = totalStars;

        // Filter out any non-numeric scores (safety guard) before aggregating
        const validScores = p.__computed.warScores.filter(s => typeof s === 'number' && !isNaN(s));
        p.__computed.totalPerfScore = validScores.reduce((acc, score) => acc + score, 0);

        // Best N of M averaging: sort descending, take the top N, average them.
        // Divisor uses min(scorableEvents, N) to avoid inflating averages for
        // players who participated in fewer wars than the target N.
        const sortedScores = [...validScores].sort((a, b) => b - a);
        const scoresToAverage = sortedScores.slice(0, appSettings.bestAttacksToAverage);

        if (scorableEventsCount > 0) {
            const sum = scoresToAverage.reduce((acc, score) => acc + score, 0);
            const divisor = Math.min(scorableEventsCount, appSettings.bestAttacksToAverage);
            p.__computed.avgPerformance = sum / divisor;
        } else {
            p.__computed.avgPerformance = 0;
        }
    });

    // Assign currentRank to each player based on avgPerformance.
    // Players with the same score share the same rank (dense ranking).
    const sortedForRank = [...players].sort((a, b) => (b.__computed.avgPerformance || 0) - (a.__computed.avgPerformance || 0));
    let currentRank = 0;
    let lastScore = -Infinity;

    sortedForRank.forEach((p, idx) => {
        const score = p.__computed.avgPerformance || 0;
        if (score !== lastScore) {
            currentRank = idx + 1; // New rank only when score changes
        }
        p.__computed.currentRank = currentRank;
        lastScore = score;
    });

    // Trigger full UI re-render with the freshly computed state
    renderPlayersTable();
    renderRankingsTable();
}

// ── STATE LOAD / INIT ─────────────────────────────────────────────────────────

/**
 * FUNCTION: loadInitialData
 * PURPOSE: Restores all state from localStorage on app startup. Called once by
 *          renderer.js during DOMContentLoaded initialization.
 *
 * SIDE EFFECTS:
 *   - Populates all state variables from localStorage
 *   - Ensures all loaded players have valid war arrays (7 entries)
 *   - Populates the clan tag input field from saved value
 *   - Falls back to cleared state + empty arrays on any parse error
 *   - Calls loadSettings() at the end, which in turn calls computeAll()
 *
 * ERROR HANDLING:
 *   - On any localStorage parse failure, clears ALL localStorage and resets
 *     state to empty. Prevents corrupted data from making the app unusable.
 *
 * CALLED BY: renderer.js (via DOMContentLoaded)
 */
export function loadInitialData() {
    try {
        // Restore players and war details from their respective localStorage keys
        const storedPlayers = JSON.parse(localStorage.getItem(config.localStorageKey) || '[]');
        const storedWarDetails = JSON.parse(localStorage.getItem('cwl_war_details') || '[]');
        cwlWarDetails = storedWarDetails;

        // Restore clan meta (name, badge, league name) for identity display
        const storedMeta = localStorage.getItem('cwl_clan_meta');
        if (storedMeta) {
            clanMeta = JSON.parse(storedMeta);
        }

        if (Array.isArray(storedPlayers) && storedPlayers.length > 0) {
            players = storedPlayers;
            // Backfill any missing fields that may have been added in newer versions
            players.forEach(p => {
                p.id = p.id || `player_${Date.now()}_${Math.random()}`;
                p.th = p.th || 18; // Default missing TH to 18 (safest assumption)
                if (!p.__computed) p.__computed = {};
            });
        } else { players = []; }

        // Restore derived values (these are also recalculated by computeAll, but
        // having them pre-populated avoids a flash of wrong values on startup)
        cwlFinished = localStorage.getItem(config.cwlFinishedKey) === 'true';
        warsWon = Number(localStorage.getItem(config.warsWonKey)) || 0;
        cwlLeague = localStorage.getItem(config.cwlLeagueKey) || LEAGUES[6].id;
        config.warFormat = Number(localStorage.getItem(config.warFormatKey)) || 15;
        activeDayForNav = Number(localStorage.getItem(config.activeDayForNavKey)) || -1;
        currentLiveDayIndex = Number(localStorage.getItem('cwl_live_day_index')) || -1;

        // Pre-populate the clan tag input with the last-used tag
        savedClanTag = localStorage.getItem('cwl_clan_tag') || '';
        if (savedClanTag && dom.clanTagInput) {
            dom.clanTagInput.value = savedClanTag;
        }

        // If a specific war day was active, sort players for that day immediately
        if (activeDayForNav !== -1) {
            sortPlayersForActiveDay();
        }
    } catch(e) {
        // Catastrophic parse failure — clear everything and start fresh
        console.error('Local storage load failed. Resetting state:', e);
        localStorage.clear();
        players = [];
        cwlWarDetails = [];
        clanMeta = null;
    }
    loadSettings(); // Always runs computeAll() at the end
}

/**
 * FUNCTION: loadSettings
 * PURPOSE: Loads appSettings from localStorage, merges with defaults (so new
 *          settings keys get their default values even for old saves), applies
 *          them to the UI, and triggers computeAll() to re-render with the
 *          correct settings (e.g., decimal places, best attacks count).
 *
 * SIDE EFFECTS:
 *   - Mutates appSettings
 *   - Calls applySettingsUI() — updates settings sidebar controls
 *   - Calls computeAll() — triggers full re-render
 *
 * CALLED BY: loadInitialData(), resetAllData(), importData()
 */
export function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem(config.settingsStorageKey));
    // Merge: spread defaults first so new keys get defaults, then override with saved values
    if (savedSettings) { appSettings = { ...appSettings, ...savedSettings }; }
    applySettingsUI();
    computeAll();
}

/**
 * FUNCTION: updateSetting
 * PURPOSE: Mutates a single settings key, persists, and re-renders.
 *          Called by event listeners in events.js for individual settings controls.
 *
 * @param key   - Key of the setting to update (must exist in appSettings object)
 * @param value - New value for that setting
 *
 * SIDE EFFECTS:
 *   - Mutates appSettings[key]
 *   - Calls saveAppState() — persists to localStorage
 *   - Calls applySettingsUI() — refreshes controls
 *   - Calls computeAll() — re-renders with new setting
 *
 * CALLED BY: events.js (change listeners on settings controls)
 */
export function updateSetting(key, value) {
    appSettings[key] = value;
    saveAppState();
    applySettingsUI();
    computeAll();
}

// ── WAR FORMAT + DAY NAV ──────────────────────────────────────────────────────

/**
 * FUNCTION: setWarFormat
 * PURPOSE: Changes the war format (15v15 or 30v30). This affects the PPS
 *          rank point calculation in calculator.js (see getPlayerStrength).
 *
 * @param newFormat - 15 or 30
 *
 * SIDE EFFECTS: Mutates config.warFormat, saves state, triggers computeAll
 * CALLED BY: events.js → warFormat radio change listener
 */
export function setWarFormat(newFormat) {
    config.warFormat = newFormat;
    saveAppState();
    computeAll();
}

/**
 * FUNCTION: setActiveDayForNav
 * PURPOSE: Changes which war day is currently displayed in the players table.
 *          dayIndex === -1 means "overview" (aggregate view across all wars).
 *
 * @param dayIndex - 0-6 for a specific war day, -1 for overview
 *
 * SIDE EFFECTS: Mutates activeDayForNav, re-sorts players, saves, triggers computeAll
 * CALLED BY: main_view.js → war day selector button clicks
 */
export function setActiveDayForNav(dayIndex) {
    activeDayForNav = dayIndex;
    sortPlayersForActiveDay();
    saveAppState();
    computeAll();
}

// ── PLAYER CRUD ───────────────────────────────────────────────────────────────

/**
 * FUNCTION: addPlayer
 * PURPOSE: Appends a new empty player with default war data to the roster.
 *          Returns the new player's ID so the caller can scroll to it.
 *
 * @returns {string} id of the newly created player
 *
 * SIDE EFFECTS: Mutates players array, triggers computeAll (saves implicitly)
 * CALLED BY: main_view.js → Add Player button
 */
export function addPlayer() {
    // Each player gets 7 default war entries (one per CWL day)
    const defaultWars = Array.from({length: config.numWars}).map(()=>({ myPosition: 0, opponentPosition: 0, opponentTh: 18, status:'', stars:0, destruction:0 }));
    const newPlayer = { id: `player_${Date.now()}_${Math.random()}`, name:'New Player', th: 18, wars: defaultWars, isBonusGiven: false, __computed:{} };
    players.push(newPlayer);
    computeAll();
    return newPlayer.id;
}

/**
 * FUNCTION: deletePlayer
 * PURPOSE: Removes a player from the roster by their current array index.
 *
 * @param originalPlayerIndex - Index in the players array to remove
 *
 * SIDE EFFECTS: Mutates players array, saves state, triggers computeAll
 * CALLED BY: main_view.js → delete button in player row
 */
export function deletePlayer(originalPlayerIndex) {
    players.splice(originalPlayerIndex, 1);
    saveAppState();
    computeAll();
}

/**
 * FUNCTION: resetAllData
 * PURPOSE: Clears all state and localStorage, resets UI controls to defaults.
 *          Called after user confirms the destructive reset action in the modal.
 *
 * SIDE EFFECTS:
 *   - Resets ALL state variables to initial values
 *   - Calls localStorage.clear() — wipes all persisted data
 *   - Resets DOM inputs to their default values
 *   - Calls updateFetchButtonState() and loadSettings() to re-initialize UI
 *   - Shows a toast confirming the reset
 *
 * CALLED BY: events.js → resetDataBtn handler (after confirmation modal)
 */
export function resetAllData() {
    players = [];
    cwlWarDetails = [];
    activeDayForNav = -1;
    currentLiveDayIndex = -1;
    cwlFinished = false;
    warsWon = 0;
    cwlLeague = LEAGUES[6].id;
    config.warFormat = 15;
    savedClanTag = '';
    clanMeta = null;
    localStorage.clear(); // Wipe ALL localStorage — full clean slate

    // Reset DOM controls to safe defaults
    dom.clanTagInput.value = '';
    dom.format15v15Radio.checked = true;
    dom.cwlFinishedCheckbox.checked = false;
    dom.warsWonSelect.value = 0;
    dom.leagueSelect.value = cwlLeague;
    if (dom.warDaySelectorContainer) dom.warDaySelectorContainer.innerHTML = '';

    updateFetchButtonState();
    loadSettings(); // Re-applies settings defaults and calls computeAll()
    showToast('All data has been successfully reset.');
}

// ── MANUAL OVERRIDE SETTERS ───────────────────────────────────────────────────
// These allow the user to manually override auto-calculated values as a fallback
// when API data is unavailable. The UI shows these controls when cwlFinished is false.

/** Override auto-calculated cwlFinished flag. CALLED BY: events.js → cwlFinishedCheckbox */
export function setCwlFinished(isFinished) { cwlFinished = isFinished; saveAppState(); computeAll(); }

/** Override auto-calculated warsWon count. CALLED BY: events.js → warsWonSelect */
export function setWarsWon(count) { warsWon = count; saveAppState(); computeAll(); }

/** Change league selection. CALLED BY: events.js → leagueSelect */
export function setCwlLeague(leagueId) { cwlLeague = leagueId; saveAppState(); computeAll(); }

// ── DATA EXPORT / IMPORT ──────────────────────────────────────────────────────

/**
 * FUNCTION: exportData
 * PURPOSE: Serializes current state to JSON (stripping __computed from all players)
 *          and sends it to main.js via the IPC bridge to write to a file.
 *
 * SIDE EFFECTS:
 *   - Calls window.api.exportData() — triggers save dialog in main process
 *   - Shows success toast on successful write
 *
 * CALLED BY: events.js → exportDataBtn click listener
 * SEE ALSO: docs/architecture/data-flow.md → Flow 3: Save
 */
export async function exportData() {
    // Strip __computed from all players — computed data is never saved (ADR-002)
    const sanitizedPlayers = players.map(p => { const { __computed, ...rest } = p; return rest; });
    const state = { players: sanitizedPlayers, cwlWarDetails, cwlFinished, warsWon, cwlLeague, warFormat: config.warFormat, appSettings, activeDayForNav, currentLiveDayIndex, clanMeta };
    const result = await window.api.exportData(JSON.stringify(state, null, 2));
    if (result.success) { showToast('Data saved successfully!'); }
}

/**
 * FUNCTION: importData
 * PURPOSE: Triggers a file open dialog via IPC, then parses the returned JSON
 *          and restores all state from it. Backfills any missing player war arrays
 *          (for backwards compatibility with older export files).
 *
 * SIDE EFFECTS:
 *   - Replaces all state variables with imported values
 *   - Resets __computed on all players (will be recalculated)
 *   - Updates all related DOM controls to reflect imported state
 *   - Calls saveAppState() and loadSettings() (which calls computeAll())
 *   - Shows success or error toast
 *
 * ERROR HANDLING:
 *   - Catches JSON parse errors and shows an error toast
 *
 * CALLED BY: events.js → importDataBtn click listener
 * SEE ALSO: docs/architecture/data-flow.md → Flow 3: Load
 */
export async function importData() {
    const result = await window.api.importData();
    if (result.success) {
        try {
            const importedData = JSON.parse(result.data);
            players = importedData.players || [];
            cwlWarDetails = importedData.cwlWarDetails || [];
            cwlFinished = importedData.cwlFinished || false;
            warsWon = importedData.warsWon || 0;
            cwlLeague = importedData.cwlLeague || LEAGUES[6].id;
            config.warFormat = importedData.warFormat || 15;
            activeDayForNav = importedData.activeDayForNav ?? -1;
            currentLiveDayIndex = importedData.currentLiveDayIndex ?? -1;
            clanMeta = importedData.clanMeta || null;

            if(importedData.appSettings) appSettings = { ...appSettings, ...importedData.appSettings };

            players.forEach(p => {
                p.id = p.id || `player_${Date.now()}_${Math.random()}`;
                p.th = p.th || 18;
                p.isBonusGiven = p.isBonusGiven || false;
                // Backfill war arrays if the imported file has fewer than 7 wars
                // (handles exports from older versions before 7-war support)
                if (!p.wars || p.wars.length < config.numWars) {
                    const existingWars = p.wars || [];
                    const needed = config.numWars - existingWars.length;
                    const newWars = Array.from({length: needed}).map(()=>({myPosition: 0, opponentPosition: 0, opponentTh: 18, status:'', stars:0, destruction:0}));
                    p.wars = existingWars.concat(newWars);
                }
                p.__computed = {}; // Always clear computed data — it will be recalculated
            });

            // Sync DOM controls to the restored state values
            dom.cwlFinishedCheckbox.checked = cwlFinished;
            dom.warsWonSelect.value = warsWon;
            dom.leagueSelect.value = cwlLeague;
            document.getElementById(`format${config.warFormat}v${config.warFormat}`).checked = true;

            saveAppState();
            loadSettings(); // Calls computeAll() at the end
            showToast('Data loaded successfully!');
        } catch (err) { console.error("Error parsing imported file:", err); showToast('Import failed: The file is invalid.', 'error'); }
    }
}

// ── LINEUP MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * FUNCTION: handleSaveLineup
 * PURPOSE: Applies a new lineup for a specific war day. Sets myPosition for all
 *          players in the lineup (by their order in the lineup array) and clears
 *          myPosition to 0 for all players not in the lineup (benched).
 *
 * @param dayIndex - 0-6: which war day's lineup to update
 * @param lineup   - Ordered array of player objects to set as the lineup.
 *                   Index 0 = map position 1 (top of war map).
 *
 * SIDE EFFECTS:
 *   - Mutates player.wars[dayIndex].myPosition for all roster members
 *   - Sets default opponentPosition if none was selected yet
 *   - Saves state and triggers computeAll
 *
 * CALLED BY: ui/modal_lineup_editor.js → Save Lineup button
 */
export function handleSaveLineup(dayIndex, lineup) {
    const lineupIds = new Set(lineup.map(p => p.id));

    // Assign map positions based on order in the lineup array
    lineup.forEach((player, index) => {
        const playerInData = players.find(p => p.id === player.id);
        if (playerInData) {
            playerInData.wars[dayIndex].myPosition = index + 1; // 1-indexed positions
            // Default opponent position to match ours if not yet set
            if (playerInData.wars[dayIndex].opponentPosition === 0) {
                playerInData.wars[dayIndex].opponentPosition = index + 1;
            }
        }
    });

    // Any player NOT in the lineup is benched (position = 0)
    players.forEach(player => {
        if (!lineupIds.has(player.id)) {
            player.wars[dayIndex].myPosition = 0;
        }
    });

    saveAppState();
    computeAll();
}

// ── API DATA PROCESSING ───────────────────────────────────────────────────────

/**
 * FUNCTION: processApiData
 * PURPOSE: Processes a fresh API response and rebuilds the player roster from it.
 *          Handles the data freeze safeguard (ADR-003), constructs player objects
 *          from clanInfo.memberList, maps war data from all 7 war days, and
 *          detects which war day is currently live.
 *
 * @param apiData - Object from main.js IPC handler:
 *                  { clanInfo, warDetails, cwlError, cwlMasterRoster }
 *   - clanInfo:       Clan data from API (/v1/clans/{tag})
 *   - warDetails:     Array[7] of war objects (or null for missing days)
 *   - cwlError:       String error message if CWL data unavailable (or null)
 *   - cwlMasterRoster: Array of player tags rostered in this CWL season
 *
 * SIDE EFFECTS:
 *   - Replaces players and cwlWarDetails with freshly built data
 *   - Updates clanMeta, currentLiveDayIndex, activeDayForNav
 *   - Calls saveAppState() and computeAll()
 *   - May show toast if cwlError is set
 *   - Returns early (NO state change) if data freeze safeguard triggers
 *
 * ERROR HANDLING (DATA FREEZE SAFEGUARD — ADR-003):
 *   If the API returns an error (cwlError) or empty warDetails while local
 *   cwlWarDetails has existing data, this function ABORTS immediately without
 *   modifying any state. This prevents a mid-season API outage from wiping
 *   locally cached war data.
 *
 * CALLED BY: events.js → handleApiFetch() (after successful API response)
 * SEE ALSO:  docs/architecture/decisions.md → ADR-003
 *            docs/architecture/data-flow.md → Flow 1
 */
export function processApiData(apiData) {
    const { clanInfo, warDetails, cwlError, cwlMasterRoster } = apiData;

    // ── DATA FREEZE SAFEGUARD (ADR-003) ──────────────────────────────────────
    // If the API returned an error but we already have local war data, ABORT.
    // Local data is more valuable than a failed/empty API response.
    // The user can refresh manually once the API recovers.
    if (cwlError && cwlWarDetails.length > 0) {
        showToast("Season data not available from API. Loaded cached data.", "info", true);
        return; // STOP HERE — do not overwrite existing data
    }
    // Also abort if API returned empty warDetails but we have existing data
    if ((!warDetails || warDetails.length === 0) && cwlWarDetails.length > 0) {
        showToast("API returned empty season. Keeping cached data.", "info", true);
        return; // STOP HERE
    }

    cwlWarDetails = warDetails || [];
    currentLiveDayIndex = -1; // Will be set below if a live war is found

    // Extract and store clan metadata for the identity bar display
    if (clanInfo) {
        clanMeta = {
            name: clanInfo.name,
            badgeUrl: clanInfo.badgeUrls?.medium,    // Medium badge image URL
            leagueName: clanInfo.warLeague?.name     // e.g., "Master League I"
        };
    }

    // Build player objects from the current clan member list
    const newPlayers = [];
    const playerMap = new Map(); // tag → player object, for quick war data lookup
    const rosterSet = new Set(cwlMasterRoster || []); // Tags in the CWL season roster

    (clanInfo.memberList || []).forEach(member => {
        // Initialize each player with 7 empty war entries
        const defaultWars = Array.from({ length: config.numWars }, () => ({
            myPosition: 0, opponentPosition: 0, opponentTh: 0,
            status: '', stars: 0, destruction: 0
        }));

        const newPlayer = {
            id: member.tag,                         // Use CoC tag as stable ID
            name: member.name,
            th: member.townHallLevel,
            clanRank: member.clanRank,              // Position in clan leaderboard
            isCwlMember: rosterSet.has(member.tag), // True if rostered in this CWL season
            wars: defaultWars,
            isBonusGiven: false,
            __computed: {}
        };
        newPlayers.push(newPlayer);
        playerMap.set(member.tag, newPlayer);
    });

    // Map war data from each day onto the corresponding player objects
    if (!cwlError && warDetails && warDetails.length > 0) {
        warDetails.forEach((war, dayIndex) => {
            if (!war || !war.clan || !war.opponent) return; // Skip missing/null war days

            // Identify which day is currently live (for auto-nav to active war)
            if (war.state === 'inWar') {
                currentLiveDayIndex = dayIndex;
            }

            // Build a position map for the enemy lineup (tag → rank)
            const enemyThMap = new Map();
            (war.opponent.members || []).forEach(m => enemyThMap.set(m.tag, m.townHallLevel));

            // Compute 1-indexed map positions for our members
            const ourActiveMembers = (war.clan.members || []).sort((a, b) => a.mapPosition - b.mapPosition);
            const ourRankMap = new Map();
            ourActiveMembers.forEach((m, i) => ourRankMap.set(m.tag, i + 1));

            // Compute 1-indexed map positions for enemy members
            const enemyActiveMembers = (war.opponent.members || []).sort((a, b) => a.mapPosition - b.mapPosition);
            const enemyRankMap = new Map();
            enemyActiveMembers.forEach((m, i) => enemyRankMap.set(m.tag, i + 1));

            // Populate each player's war data for this day
            (war.clan.members || []).forEach((member) => {
                const player = playerMap.get(member.tag);
                if (player) {
                    player.wars[dayIndex].myPosition = ourRankMap.get(member.tag) || 0;

                    if (player.wars[dayIndex].myPosition > 0) {
                        // Default status for players in lineup: 'missed' if war ended (overridden below if attacked)
                        if (war.state === 'warEnded') {
                            player.wars[dayIndex].status = 'missed'; // Will be corrected if attack found
                        } else {
                            player.wars[dayIndex].status = ''; // Pending (in prep or live but not attacked)
                        }
                    }

                    // Populate actual attack data if the player attacked
                    if (member.attacks && Array.isArray(member.attacks)) {
                        member.attacks.forEach(attack => {
                            const warDayData = player.wars[dayIndex];
                            warDayData.status = 'attacked';
                            warDayData.stars = attack.stars;
                            warDayData.destruction = attack.destructionPercentage;

                            // Look up the defender's TH level and map position
                            const opponentMember = war.opponent.members.find(m => m.tag === attack.defenderTag);
                            if (opponentMember) {
                                warDayData.opponentTh = opponentMember.townhallLevel;
                                warDayData.opponentPosition = enemyRankMap.get(attack.defenderTag) || 0;
                            } else {
                                // Fallback: defender found in enemyThMap but not members list
                                warDayData.opponentTh = enemyThMap.get(attack.defenderTag) || 0;
                            }
                        });
                    }
                }
            });
        });

        // Auto-detect war format from the first war's teamSize (15 or 30)
        if (warDetails[0] && warDetails[0].teamSize) {
            config.warFormat = warDetails[0].teamSize;
            document.getElementById(`format${config.warFormat}v${config.warFormat}`).checked = true;
        }
    } else if (cwlError) {
        // CWL data unavailable (off-season or not in CWL) — show informational message
        showToast(cwlError, 'error');
    }

    players = newPlayers; // Replace roster with freshly built player objects

    // Auto-navigate to the currently live war day, or reset to overview
    if (currentLiveDayIndex !== -1) {
        activeDayForNav = currentLiveDayIndex;
    } else {
        activeDayForNav = -1;
    }

    saveAppState();
    computeAll();
}