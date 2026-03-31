# CWL Performance Tracker — Agent Rules
## Read this at the start of every session. Follow every rule, every time.

---

## WHO YOU ARE

You are an AI agent working on the **CWL Performance Tracker** — a cross-platform
Electron desktop app that fetches live Clash of Clans CWL data via the official
CoC REST API and computes fair bonus distribution rankings using a custom weighted
performance scoring algorithm.

The owner uses AI-assisted development and **has not written the code themselves.**
This means:
- Every decision must be traceable
- Every function must be self-explanatory from its comments alone
- Every IPC call must document its request and response shape
- When something breaks mid-CWL season, the owner must debug without your help

---

## THE PROJECT MAP

```
CWL-Bonus-Distr/
├── main.js              ← MAIN PROCESS: CoC API calls, file I/O, IPC handlers
├── preload.js           ← IPC BRIDGE: contextBridge — the only link between processes
├── renderer.js          ← RENDERER ENTRY: initializes all modules
├── index.html           ← UI shell
├── style.css            ← all styles
├── api_config.json      ← API token — NEVER commit this file
├── AGENT_INSTRUCTIONS.md  ← one-time setup (already executed)
├── AGENT_RULES.md         ← THIS FILE
└── js_modules/
    ├── config.js        ← ALL constants: TH map, leagues, localStorage keys
    ├── calculator.js    ← THE SCORING ALGORITHM (core logic — handle with care)
    ├── state.js         ← ALL app state + computeAll() + processApiData()
    ├── events.js        ← ALL DOM event listeners and auto-refresh
    └── ui/
        ├── dom.js                     ← cached DOM refs (single source of truth)
        ├── components.js              ← toast, modal, tooltip, accordion
        ├── main_view.js               ← renders players + rankings tables
        ├── modal_attackdata_editor.js ← per-player war stats viewer
        ├── modal_lineup_editor.js     ← war day lineup viewer
        └── th_selector.js             ← custom TH level dropdown
```

---

## ELECTRON PROCESS MODEL — UNDERSTAND THIS FIRST

This app runs in two completely isolated processes:

```
MAIN PROCESS (main.js)          RENDERER PROCESS (browser)
Node.js — full OS access         Sandboxed — no Node.js access
         │                                │
         │    preload.js (bridge)         │
         │  contextBridge exposes:        │
         │  window.api.fetchClanData()   │
         │  window.api.exportData()      │
         │  window.api.importData()      │
         └────────────────────────────────┘
```

**Rules:**
- NEVER call `supabase`, `fs`, `https`, or any Node module from the renderer
- NEVER call DOM APIs from `main.js`
- ALL privileged operations go through `window.api.*`
- If you need a new privileged operation, add it to `preload.js` AND handle it in `main.js`

---

## MODULE OWNERSHIP — WHO DOES WHAT

| Module | Owns | Must NOT |
|---|---|---|
| `main.js` | API calls, file I/O, IPC | Touch DOM, import renderer modules |
| `preload.js` | contextBridge surface | Business logic |
| `config.js` | Constants only | State, side effects |
| `calculator.js` | Score math only | State mutations, DOM, IPC |
| `state.js` | All state + computeAll | Direct DOM (delegate to ui/) |
| `events.js` | Event wiring | State logic (delegate to state.js) |
| `ui/dom.js` | DOM ref cache | Logic, events |
| `ui/components.js` | Reusable UI primitives | App-specific business logic |
| `ui/main_view.js` | Table rendering | State mutations |

---

## BEFORE YOU WRITE A SINGLE LINE OF CODE

1. **Check `docs/features/`** — does a design doc exist for this feature? Read it first.
2. **Check `docs/architecture/decisions.md`** — is this decision already made?
3. **Check which process your code belongs in** — main or renderer?
4. **If no design doc exists, write one first** — get owner confirmation before coding.

---

## SCORING ALGORITHM — HANDLE WITH EXTREME CARE

`calculator.js` is the most sensitive file. The scoring formula is:

```
finalScore = (starScore + destruction × 0.2) × (defenderPPS / attackerPPS)

PPS = ((warFormat + 1 - position) / warFormat) × 65
      + TH_STRENGTH_MAP[th]
      + 100  (POINTS_BUFFER)

starScore: 1★=40  2★=70  3★=80
missedAttack: -20 (flat penalty)
```

**Rules for touching this file:**
- Never change weights without documenting the reasoning in `docs/deep-dives/scoring-algorithm.md`
- Never change `TH_STRENGTH_MAP` values without a changelog entry
- When a new TH level is released, update: `config.js` (map value) + `th_selector.js` (loop max)
- Always test score changes against real CWL data before committing
- See `docs/deep-dives/scoring-algorithm.md` for full derivation

---

## DATA RULES — NON-NEGOTIABLE

| Rule | Why |
|---|---|
| Never store `__computed` in localStorage or exports | Computed scores are always recalculated fresh |
| Never call `supabase` or any DB — there is none | This app uses localStorage + JSON files only |
| Use `Promise.all` for parallel independent API calls | Sequential awaits multiply latency |
| Never overwrite `processApiData()` result if local data exists | Data freeze safeguard protects mid-season data |
| Always call `saveAppState()` after any state mutation | Ensures localStorage stays in sync |
| Always call `computeAll()` after data changes | Ensures scores and UI are always up to date |

---

## CODE COMMENTING RULES — NON-NEGOTIABLE

### Rule 1 — Every file gets a header

```javascript
/**
 * FILE: filename.js
 * PROCESS: Main | Renderer
 * ROLE: One sentence.
 *
 * DEPENDENCIES:
 *   - name: why needed
 *
 * EXPORTS:
 *   - functionName(): description
 *
 * IPC: (main.js and preload.js only)
 *   - Handles/Exposes: 'channel-name' — what it does
 *
 * DOCS:
 *   - docs/path/to/doc.md
 */
```

### Rule 2 — Every function gets JSDoc

```javascript
/**
 * FUNCTION: name
 * PURPOSE: What and why.
 *
 * @param name - description, valid values, source
 * @returns description
 *
 * CALLED BY: file.js → caller
 * CALLS: what this function invokes
 *
 * SIDE EFFECTS: state changes, DOM updates, IPC calls, localStorage writes
 * ERROR HANDLING: what happens on failure
 * SEE ALSO: docs/path/to/doc.md
 */
```

### Rule 3 — Every IPC call gets a comment

```javascript
// IPC → 'fetch-clan-data'
// Sends: clanTag (string, e.g. '#2PP')
// Returns: { success: bool, data: { clanInfo, warDetails, cwlError, cwlMasterRoster } }
//          | { success: false, error: string }
// See: docs/architecture/data-flow.md → Flow 1
const result = await window.api.fetchClanData(clanTag);
```

### Rule 4 — Every localStorage operation gets a comment

```javascript
// Saves full player array (without __computed) to localStorage.
// Key: 'cwl_players_v5' — versioned to avoid conflicts with old data shapes.
localStorage.setItem(config.localStorageKey, JSON.stringify(sanitizedPlayers));
```

### Rule 5 — Label the three phases in computeAll()

```javascript
// ─── PHASE 1: AUTO-CALCULATE WARS WON + SEASON STATUS ───────────────────────
// ─── PHASE 2: AUTO-CALCULATE BONUS COUNT ─────────────────────────────────────
// ─── PHASE 3: CALCULATE PERFORMANCE SCORES FOR ALL PLAYERS ───────────────────
```

### Rule 6 — Comment the data freeze safeguard

```javascript
// DATA FREEZE SAFEGUARD: If API returns error/empty but we have local data,
// abort the update to protect cached war data from API outages.
// See: docs/architecture/decisions.md → ADR-003
```

---

## COMMIT RULES

Follow Conventional Commits:

```
type(scope): short description
```

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `refactor` | Code restructure, no behavior change |
| `chore` | Config, dependencies |

**Scopes for this project:** `(main)`, `(renderer)`, `(calculator)`, `(state)`,
`(events)`, `(ui)`, `(config)`, `(api)`, `(docs)`

---

## DOCUMENTATION RULES — NON-NEGOTIABLE

### After completing a feature:
- Write `docs/features/<feature>/implementation.md`
- Update `docs/changelogs/CHANGELOG.md`
- Create `docs/changelogs/vX.Y.Z.md`

### After changing the architecture:
- Update `docs/architecture/overview.md`
- Update `docs/architecture/data-flow.md` if data flow changed

### After any significant decision:
- Add ADR to `docs/architecture/decisions.md`

### After changing the scoring algorithm:
- Update `docs/deep-dives/scoring-algorithm.md`
- Update `docs/features/scoring-algorithm/implementation.md`

### After adding a new TH level:
- Update `TH_STRENGTH_MAP` in `config.js`
- Update loop max in `th_selector.js`
- Update scoring deep dive doc
- Add changelog entry

---

## SEASON TIMING AWARENESS

CWL season runs for approximately 10 days per month. During an active season:
- **Never** run destructive operations (reset, schema changes) without explicit owner confirmation
- **Always** test data freeze safeguard behavior after any `processApiData()` changes
- **Prioritize** stability over features — a bug during live CWL cannot wait for next season

---

## IF SOMETHING IS UNCLEAR

Do not guess. Ask first. Specifically:
- If changing scoring weights — confirm exact new values with owner before touching `calculator.js`
- If adding a new IPC channel — confirm the data shape before implementing both sides
- If `api_config.json` is involved — never log or expose the token value
- If the data freeze safeguard might be affected — flag it before proceeding

---

*CWL Performance Tracker — Agent Rules — updated 2026-03-30*
