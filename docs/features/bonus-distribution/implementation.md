# Feature Implementation — Bonus Distribution

**Status:** Active (v1.0.0, automated in v1.1.0)
**Files:** `js_modules/state.js` → `computeAll()`, `js_modules/ui/main_view.js` → `renderRankingsTable()`

---

## What It Does

Calculates how many CWL bonus medals are available to distribute, then provides
a ranked list of players with checkboxes to mark who receives a bonus.

---

## Bonus Count Formula

```
bonusCount = leagueBase + warsWon
```

| Component | Source | Example |
|---|---|---|
| `leagueBase` | League tier from `LEAGUES` config (or API's `warLeague.name`) | Master I = 3 |
| `warsWon` | Auto-calculated from `warDetails` in `computeAll()` | 4 wins |
| `bonusCount` | Sum of above | 7 bonuses |

---

## Win Detection Logic

A war is counted as a **win** if:
1. `war.state === 'warEnded'` (confirmed finished), AND
2. `war.clan.stars > war.opponent.stars` (more stars), OR
3. `war.clan.stars === war.opponent.stars` AND `war.clan.destructionPercentage > war.opponent.destructionPercentage` (tiebreaker)

---

## Automation History

### v1.0.0 (Manual)
- `warsWon` was a manual dropdown input by the user
- `cwlFinished` was a manual checkbox
- `bonusCount` was computed from the manually-set values

### v1.1.0 (Automated)
- `warsWon` is now auto-calculated from `warDetails` in `computeAll()`
- `cwlFinished` is now auto-detected when 7 wars have started/ended
- Manual controls remain as fallback (shown when `cwlFinished === false`)

---

## Rankings Display

Players are ranked by `avgPerformance` (descending). The rankings table:
- Only shows players with at least 1 participation (`participations > 0`)
- Uses dense ranking (tied players share the same position)
- Shows top 3 with gold/silver/bronze trophy icons
- Shows bonus checkboxes ONLY when `cwlFinished === true`

---

## Bonus Checkbox Logic

- Checkboxes are limited: once `bonusesChecked >= bonusCount`, unchecked players' boxes are disabled
- Already-checked players can still uncheck (their box remains enabled)
- `isBonusGiven` is persisted to `localStorage` via `saveAppState()`
- The season summary card shows the total `bonusCount` for easy reference

---

## Files

- `js_modules/config.js` — `LEAGUES` array with `base` values per tier
- `js_modules/state.js` → `computeAll()` — Phase 1 (wars won) and Phase 2 (bonus count)
- `js_modules/ui/main_view.js` → `renderRankingsTable()` — summary card + checkbox logic
