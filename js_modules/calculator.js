/**
 * FILE: calculator.js
 * PROCESS: Renderer
 * ROLE: The scoring algorithm — computes a difficulty-adjusted performance score
 *       for a single player attack. Pure math only: no state mutations, no DOM
 *       access, no API calls.
 *
 * DEPENDENCIES:
 *   - config.js: TH_STRENGTH_MAP (TH difficulty values), POINTS_BUFFER (ratio stabilizer)
 *   - state.js:  getState() — reads warFormat to scale position rank points
 *
 * EXPORTS:
 *   - getPlayerStrength(th, position): Computes Player Position Strength (PPS)
 *   - calculatePerformanceScore(player, warData): Computes final difficulty-adjusted score
 *
 * DOCS:
 *   - docs/deep-dives/scoring-algorithm.md         ← Full formula breakdown
 *   - docs/features/scoring-algorithm/implementation.md ← Change history
 */

import { config } from './config.js';
import { getState } from './state.js';

/**
 * FUNCTION: getPlayerStrength
 * PURPOSE: Computes the Player Position Strength (PPS) for a given TH level and
 *          war map position. Used as both the attacker's strength and the
 *          defender's strength in the difficulty multiplier calculation.
 *
 * @param th       - Town Hall level (1–18). From player.th or warData.opponentTh.
 *                   Pass 0 if TH is unknown — function returns 0 (invalid guard).
 * @param position - War map position (1 = top/strongest, warFormat = bottom/weakest).
 *                   Pass 0 if not in lineup — function returns 0 (invalid guard).
 * @returns PPS score (float). Returns 0 if th or position is 0.
 *
 * FORMULA:
 *   rankPoints = ((warFormat + 1 - position) / warFormat) × 65
 *     → Position 1 gets full 65 rank points; position N gets nearly 0
 *   thPoints   = TH_STRENGTH_MAP[th]
 *     → Manually calibrated per-TH difficulty value
 *   PPS        = rankPoints + thPoints + POINTS_BUFFER
 *     → POINTS_BUFFER (100) prevents extreme ratios for mismatched TH levels
 *
 * CALLED BY: calculator.js → calculatePerformanceScore() (twice per attack —
 *            once for the attacker, once for the defender)
 *
 * SEE ALSO: docs/deep-dives/scoring-algorithm.md → Component Breakdown → PPS
 */
export function getPlayerStrength(th, position) {
    // Guard: invalid inputs return 0 — caller checks for 0 before dividing
    if (position === 0 || th === 0) return 0;

    const { warFormat } = getState();
    const rankMax = warFormat; // 15 for 15v15, 30 for 30v30

    // Higher position number = weaker player = fewer rank points
    // Position 1 → ((rankMax + 1 - 1) / rankMax) × 65 = 65 (max points)
    // Position 15 → ((rankMax + 1 - 15) / rankMax) × 65 ≈ 4.3 (min points for 15v15)
    const rankPoints = ((rankMax + 1 - position) / rankMax) * 65;

    // Look up TH's manually calibrated strength value (defaults to 0 for unknown TH)
    const thPoints = config.TH_STRENGTH_MAP[th] || 0;

    return rankPoints + thPoints + config.POINTS_BUFFER;
}

/**
 * FUNCTION: calculatePerformanceScore
 * PURPOSE: Computes a difficulty-adjusted performance score for a single player
 *          attack. Accounts for stars earned, destruction %, and the relative
 *          strength difference between attacker and defender.
 *
 * @param player  - Full player object from state. Needs: player.th.
 * @param warData - Single war entry from player.wars[dayIndex]:
 *                  { myPosition, opponentTh, opponentPosition, stars, destruction, status }
 * @returns {number|null}
 *   - null  → Not scorable (player not in lineup OR war not yet started)
 *   - -20   → Missed attack penalty (flat punish for not attacking)
 *   - 0     → Invalid PPS data (opponentTh or myPosition are unknown)
 *   - float → Difficulty-adjusted score (typical range: 10–120+)
 *
 * SCORING FORMULA:
 *   starScore       = 40 (1★) | 70 (2★) | 80 (3★)
 *     → Non-linear because 1★→2★ is a bigger threshold than 2★→3★
 *   destructionBonus = destruction × 0.2  (max 20 points)
 *     → Rewards partial progress; keeps bonus below the star score ceiling
 *   baseScore       = starScore + destructionBonus
 *   attackerPPS     = getPlayerStrength(player.th, myPosition)
 *   defenderPPS     = getPlayerStrength(opponentTh, opponentPosition)
 *   multiplier      = defenderPPS / attackerPPS
 *     → > 1: harder attack (defender > attacker) → score boosted
 *     → < 1: easier attack (attacker > defender) → score reduced
 *     → ≈ 1: fair matchup → score unchanged
 *   finalScore      = baseScore × multiplier
 *
 * SPECIAL CASES:
 *   - myPosition === 0 or status === '': player not in lineup / war not started → null
 *   - status === 'missed': no attack made → flat -20 penalty
 *   - attackerPPS/defenderPPS === 0: unknown TH data → 0 (safe fallback)
 *
 * CALLED BY:
 *   - state.js → computeAll()                          (scoring pipeline)
 *   - ui/modal_attackdata_editor.js → createWarRowDisplay() (display only)
 *
 * SEE ALSO: docs/deep-dives/scoring-algorithm.md
 */
export function calculatePerformanceScore(player, warData) {
    // Guard: player not in lineup (position 0) OR war hasn't started (status empty)
    // Return null so the caller knows this war day contributes nothing
    if (warData.myPosition === 0 || !warData.status || warData.status === '') return null;

    // Missed attack: flat -20 penalty. Worse than a weak 1-star because it:
    // (a) denies the clan a potential star, and (b) wastes an attack slot.
    if (warData.status === 'missed') return -20;

    // ── BASE ATTACK SCORE ────────────────────────────────────────────────────
    // Star scores are non-linear: 2★ is weighted much higher than 1★.
    // Getting 2 stars (destroying the Town Hall) is a major threshold in CWL.
    let starScore = 0;
    if (warData.stars === 1) starScore = 40;
    else if (warData.stars === 2) starScore = 70;
    else if (warData.stars === 3) starScore = 80;

    // Destruction bonus: rewards partial progress within a star tier.
    // A 99% 2-star should score more than a 50% 2-star. The 0.2 multiplier
    // keeps the bonus (max 20 pts) meaningful without dominating the star score (max 80 pts).
    const destructionBonus = (warData.destruction || 0) * 0.2;
    const baseAttackScore = starScore + destructionBonus;

    // ── DIFFICULTY MULTIPLIER ────────────────────────────────────────────────
    const attackerPPS = getPlayerStrength(player.th, warData.myPosition);
    const defenderPPS = getPlayerStrength(warData.opponentTh, warData.opponentPosition);

    // Guard: if either PPS is 0, data is incomplete — return 0 instead of NaN/Infinity
    if (attackerPPS === 0 || defenderPPS === 0) return 0;

    // The ratio scales the score up or down based on how hard the attack was:
    // - attacking up (defender stronger) → ratio > 1 → score boosted
    // - attacking equal → ratio ≈ 1 → score unchanged
    // - attacking down (attacker stronger) → ratio < 1 → score reduced
    const difficultyMultiplier = defenderPPS / attackerPPS;
    return baseAttackScore * difficultyMultiplier;
}