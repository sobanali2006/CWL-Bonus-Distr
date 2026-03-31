# Feature Implementation — Scoring Algorithm

**Status:** Active (v1.0.0, updated v1.1.0)
**Files:** `js_modules/calculator.js`, `js_modules/config.js`

---

## What It Does

Computes a fair performance score for each player attack that accounts for:
- Stars earned
- Destruction percentage
- Relative difficulty (attacker strength vs defender strength)

See `docs/deep-dives/scoring-algorithm.md` for the full mathematical breakdown.

---

## Change History

### v1.1.0
- Added TH18 to `TH_STRENGTH_MAP` with value 35
- Updated TH selector to start at TH18

### v1.0.0
- Initial algorithm implementation
- TH strength values calibrated up to TH17
- Missed attack penalty set to -20
- POINTS_BUFFER set to 100

---

## Calibration Notes

The `TH_STRENGTH_MAP` values are manually tuned. When a new TH level is released:

1. Add the new TH level to `TH_STRENGTH_MAP` in `config.js`
2. Estimate the strength value based on the gap from the previous TH
3. Update the TH selector loop maximum in `th_selector.js`
4. Update the `TH_STRENGTH_MAP` comment in this file
5. Test against real CWL data from the new season
6. Add a changelog entry

---

## Known Limitations

- TH strength values are estimates, not official Supercell data
- The algorithm only supports one attack per player per war (CoC CWL rules)
- Destruction bonus cap is implicit (100% × 0.2 = 20 max bonus points)
