# CWL Performance Tracker — Scoring Algorithm Deep Dive

> A first-principles breakdown of how player performance scores are calculated,
> why each component exists, and how the difficulty multiplier works.

---

## The Problem This Solves

Raw stars are a terrible measure of CWL performance. Consider:
- Player A (TH18, position 1) attacks enemy position 1 (TH18) → gets 2 stars
- Player B (TH11, position 14) attacks enemy position 15 (TH9) → gets 2 stars

Both got 2 stars. But Player A's attack was dramatically harder. A fair bonus
distribution system must account for this difficulty gap.

---

## The Formula

```
finalScore = baseAttackScore × difficultyMultiplier
```

Where:

```
baseAttackScore = starScore + destructionBonus
starScore       = 40 (1★) | 70 (2★) | 80 (3★)
destructionBonus = destructionPercentage × 0.2

attackerPPS = ((warFormat + 1 - myPosition) / warFormat) × 65
              + TH_STRENGTH_MAP[attackerTH]
              + POINTS_BUFFER (100)

defenderPPS = ((warFormat + 1 - opponentPosition) / warFormat) × 65
              + TH_STRENGTH_MAP[defenderTH]
              + POINTS_BUFFER (100)

difficultyMultiplier = defenderPPS / attackerPPS
```

---

## Component Breakdown

### 1. Star Score (40 / 70 / 80)

Why not linear (33/66/100)?

- 1★ to 2★ is a massive jump — it means full destruction of the Town Hall
- 2★ to 3★ is harder but the marginal value is smaller (cleanup)
- The 40/70/80 scale reflects this non-linear difficulty curve

### 2. Destruction Bonus (percentage × 0.2)

Rewards partial progress. A 99% 2-star attack scores more than a 50% 2-star.
The 0.2 multiplier keeps the bonus meaningful (max 20 points) without
overwhelming the star score (which tops at 80 points).

### 3. Player Position Strength (PPS)

```
rankPoints = ((warFormat + 1 - position) / warFormat) × 65
```

Position 1 (top) gets maximum rank points. Position 15 (bottom of 15v15) gets
the minimum. The 65-point scale was chosen so rank points contribute meaningfully
but don't dominate over TH level.

`POINTS_BUFFER = 100` is added to both attacker and defender PPS. This prevents
the ratio from being extreme when one side has very low raw PPS. Without the buffer,
a TH5 attacking a TH18 would produce an astronomically large multiplier.

### 4. TH Strength Map

```javascript
TH_STRENGTH_MAP = {
  18: 35, 17: 31.18, 16: 28, 15: 25.73, 14: 23.25,
  13: 20.63, 12: 17.37, 11: 15.39, 10: 12.34, 9: 9.9,
  8: 6.31, 7: 5.02, 6: 2.57, 5: 1.37, 4: 0.9, 3: 0.3, 2: 0.21, 1: 0.05
}
```

These values are manually calibrated — not derived from a formula. The gaps
between levels reflect real-world attack difficulty differences.
Key observations:
- TH17→TH18: +3.82 (moderate jump — TH18 is very strong but not overwhelming)
- TH13→TH14: +2.62 (Giga Inferno introduction — significant power jump)
- TH8→TH9: +3.59 (Eagle Artillery — major defensive upgrade)

**⚠️ Must update when new TH levels are released.**

### 5. Difficulty Multiplier

```
difficultyMultiplier = defenderPPS / attackerPPS
```

- Attacker stronger than defender → multiplier < 1 → score reduced (easy attack)
- Attacker equal to defender → multiplier ≈ 1 → score unchanged
- Attacker weaker than defender → multiplier > 1 → score boosted (hard attack)

### 6. Missed Attack Penalty (-20)

A flat -20 score for any missed attack. This is a fixed penalty rather than
a 0 because missing is worse than making a weak attack — it denies your clan
a potential star AND wastes an attack slot.

---

## Averaging Logic (Best N of M)

After scoring all 7 wars, the final ranking uses an average of the player's
best N scores, where N is configured in settings (default: 6).

```
sortedScores = warScores.sort(descending)
scoresToAverage = sortedScores.slice(0, bestAttacksToAverage)
avgPerformance = sum(scoresToAverage) / min(scorableEvents, bestAttacksToAverage)
```

The divisor uses `min(scorableEvents, N)` to avoid inflating averages for
players who participated in fewer wars.

---

## Edge Cases

| Situation | Handled By |
|---|---|
| Player not in lineup (bench) | `myPosition === 0` → score = 0 for that war |
| War not yet started | `status === ''` → excluded from scoring |
| Missed attack | `status === 'missed'` → flat -20 |
| API returns opponentTh = 0 | `getPlayerStrength(0, x)` returns 0 → score = 0 |
| Attacker or defender PPS = 0 | Guard in `calculatePerformanceScore` → return 0 |

---

## Files

- `js_modules/calculator.js` — formula implementation
- `js_modules/config.js` — TH_STRENGTH_MAP, POINTS_BUFFER constants
- `js_modules/state.js` → `computeAll()` — calls calculator and aggregates scores
- `docs/features/scoring-algorithm/implementation.md` — change history
