/**
 * FILE: config.js
 * PROCESS: Renderer
 * ROLE: Single source of truth for all application constants. No business logic,
 *       no state, no side effects — only pure constant definitions.
 *
 * DEPENDENCIES: none
 *
 * EXPORTS:
 *   - LEAGUES: Array of all CWL league tiers with their bonus base values
 *   - config: Object holding TH strength map, localStorage keys, and runtime settings
 *
 * DOCS:
 *   - docs/deep-dives/scoring-algorithm.md → TH Strength Map section
 *   - docs/architecture/data-flow.md       → localStorage Key Map
 */

// ── LEAGUE DEFINITIONS ────────────────────────────────────────────────────────
// Each entry represents a CWL league tier.
// `base` = the minimum number of bonus medals guaranteed regardless of wins.
// This is the "league base" added to warsWon in the bonus count formula:
//   bonusCount = leagueBase + warsWon
// Champion leagues give 4 base, Masters give 3, lower leagues give 2 or 1.
export const LEAGUES = [
    { id: 'champ1', name: 'Champion I', base: 4 }, { id: 'champ2', name: 'Champion II', base: 4 }, { id: 'champ3', name: 'Champion III', base: 4 },
    { id: 'master1', name: 'Master I', base: 3 }, { id: 'master2', name: 'Master II', base: 3 }, { id: 'master3', name: 'Master III', base: 3 },
    { id: 'crystal1', name: 'Crystal I', base: 2 }, { id: 'crystal2', name: 'Crystal II', base: 2 }, { id: 'crystal3', name: 'Crystal III', base: 2 },
    { id: 'gold1', name: 'Gold I', base: 2 }, { id: 'gold2', name: 'Gold II', base: 2 }, { id: 'gold3', name: 'Gold III', base: 2 },
    { id: 'silver1', name: 'Silver I', base: 1 }, { id: 'silver2', name: 'Silver II', base: 1 }, { id: 'silver3', name: 'Silver III', base: 1 },
    { id: 'bronze1', name: 'Bronze I', base: 1 }, { id: 'bronze2', name: 'Bronze II', base: 1 }, { id: 'bronze3', name: 'Bronze III', base: 1 },
];

export const config = {
    // CWL always has exactly 7 war days
    numWars: 7,

    // ── POINTS_BUFFER ─────────────────────────────────────────────────────────
    // Added to BOTH attacker and defender PPS (Player Position Strength) before
    // computing the difficulty ratio. This prevents extreme multipliers when
    // comparing very mismatched TH levels (e.g., TH5 vs TH18).
    // Without this buffer, a TH5 attacking a TH18 would produce an astronomically
    // large score. 100 was chosen empirically to keep ratios meaningful but bounded.
    // See: docs/deep-dives/scoring-algorithm.md → Component Breakdown → POINTS_BUFFER
    POINTS_BUFFER: 100,

    // ── TH STRENGTH MAP ──────────────────────────────────────────────────────
    // Manually calibrated values representing the relative defensive and offensive
    // strength of each Town Hall level. NOT a formula — these reflect real-world
    // CWL attack difficulty as observed in actual gameplay.
    //
    // Key calibration observations:
    //   TH8→TH9:   +3.59 — Eagle Artillery introduction (major defensive jump)
    //   TH13→TH14: +2.62 — Giga Inferno (significant power jump)
    //   TH17→TH18: +3.82 — TH18 is strong, added in v1.1.0
    //
    // ⚠️ MUST BE UPDATED when a new TH level is released by Supercell.
    // See: docs/features/scoring-algorithm/implementation.md → Calibration Notes
    // See: docs/architecture/decisions.md → ADR-004
    TH_STRENGTH_MAP: {
        18: 35,
        17: 31.18,
        16: 28,
        15: 25.73,
        14: 23.25,
        13: 20.63,
        12: 17.37,
        11: 15.39,
        10: 12.34,
        9: 9.9,
        8: 6.31,
        7: 5.02,
        6: 2.57,
        5: 1.37,
        4: 0.9,
        3: 0.3,
        2: 0.21,
        1: 0.05
    },

    // ── LOCALSTORAGE KEYS ─────────────────────────────────────────────────────
    // All localStorage keys should be defined here — never hardcoded elsewhere.
    // `_v5` suffix on localStorageKey indicates the current data schema version.
    // If the player object shape ever changes in a breaking way, increment this
    // version number and handle migration in loadInitialData().
    localStorageKey: 'cwl_players_v5',       // Full player array (no __computed)
    settingsStorageKey: 'cwl_settings_v1',   // appSettings object
    cwlFinishedKey: 'cwl_finished_status',   // Boolean: is the CWL season over?
    warsWonKey: 'cwl_wars_won',              // Number: how many wars the clan won
    cwlLeagueKey: 'cwl_league_id',           // String: selected league ID (e.g. 'master1')
    warFormatKey: 'cwl_war_format',          // Number: 15 or 30 (15v15 or 30v30)
};