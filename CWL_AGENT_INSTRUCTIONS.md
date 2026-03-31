# CWL Performance Tracker — Agent Instructions
## One-Time Setup: Documentation, Structure & Code Annotation

> **Purpose:** This file is a complete, step-by-step instruction set for an AI agent.
> Execute every section in order. Do not skip steps. Verify each step before proceeding.
> Check if a target already exists before creating it — never overwrite existing work.
> When in doubt, ask the owner before acting.

---

## WHO YOU ARE & WHAT YOU'RE DOING

You are helping set up the documentation and code annotation infrastructure for the
**CWL Performance Tracker** — a cross-platform Electron desktop app that fetches live
Clash of Clans Clan War League data via the official CoC REST API and computes fair
bonus distribution rankings using a custom weighted performance scoring algorithm.

The owner uses AI-assisted development ("vibe coding") and needs every file, function,
and decision to be fully traceable. When something breaks mid-CWL season, the owner
must be able to debug independently without needing the original author present.

**Your two jobs in this session:**
1. Create the full `docs/` directory structure and populate every document with content
2. Add detailed inline comments to all source files

---

## THE FULL FILE MAP (know this before touching anything)

```
CWL-Bonus-Distr/
├── main.js              ← Electron main process: API calls, file I/O, IPC handlers
├── preload.js           ← Secure IPC bridge (contextBridge) between main and renderer
├── renderer.js          ← Frontend entry point: initializes all modules on DOMContentLoaded
├── index.html           ← App shell: all UI structure, no logic
├── style.css            ← All styling
├── package.json         ← Electron app config, version, build settings
├── api_config.json      ← API token storage (NOT committed to Git — add to .gitignore)
├── AGENT_INSTRUCTIONS.md  ← THIS FILE (one-time setup)
├── AGENT_RULES.md         ← Permanent session rules
└── js_modules/
    ├── config.js        ← All constants: TH strength map, league definitions, localStorage keys
    ├── calculator.js    ← THE SCORING ALGORITHM: performance score per attack
    ├── state.js         ← All app state, computeAll(), processApiData(), save/load
    ├── events.js        ← All DOM event listeners, auto-refresh timer, fetch handler
    └── ui/
        ├── dom.js                     ← Cached DOM element references (single source of truth)
        ├── components.js              ← Reusable UI: toast, modal, tooltip, accordion, inputs
        ├── main_view.js               ← Renders players table and rankings table
        ├── modal_attackdata_editor.js ← Per-player war stats viewer modal
        ├── modal_lineup_editor.js     ← War day lineup viewer modal (clan vs enemy)
        └── th_selector.js             ← Custom Town Hall level dropdown component
```

---

## PART 1 — DOCS DIRECTORY SETUP

### Step 1.1 — Create the folder skeleton

Run from the project root:

```bash
mkdir -p docs/architecture
mkdir -p docs/changelogs
mkdir -p docs/guides
mkdir -p docs/deep-dives
mkdir -p docs/features/scoring-algorithm
mkdir -p docs/features/api-integration
mkdir -p docs/features/bonus-distribution
mkdir -p docs/features/public-server
mkdir -p docs/features/offline-mode
```

Verify:
```bash
find docs/ -type d
```

---

### Step 1.2 — Create `docs/README.md` (master index)

```markdown
# CWL Performance Tracker — Documentation Index

Single source of truth for all project documentation.

---

## Quick Navigation

| I want to... | Go to |
|---|---|
| Understand the overall system | [Architecture Overview](architecture/overview.md) |
| Understand the scoring algorithm | [Scoring Algorithm Deep Dive](deep-dives/scoring-algorithm.md) |
| Understand the IPC bridge | [Architecture Overview](architecture/overview.md) |
| See the data flow end-to-end | [Data Flow](architecture/data-flow.md) |
| Check why a decision was made | [Decisions Log](architecture/decisions.md) |
| Set up the project locally | [Local Setup Guide](guides/local-setup.md) |
| Understand the API integration | [API Integration](features/api-integration/implementation.md) |
| See what changed per version | [Changelogs](changelogs/) |
| Plan the public server feature | [Public Server Design](features/public-server/design.md) |

---

## Project Roadmap

```
v1.1.0 — Current
  ✅ Live API data fetching (CoC REST API)
  ✅ Custom weighted performance scoring algorithm
  ✅ Automated wars won + bonus count calculation
  ✅ War day lineup viewer (clan vs enemy)
  ✅ Per-player attack data editor
  ✅ Hide Non-CWL / Hide Bench toggles
  ✅ Auto-refresh (configurable interval)
  ✅ Save / Load JSON export
  ✅ Season summary card (auto-shown when CWL ends)
  ✅ Traffic light attack status indicators
  ✅ Documentation infrastructure

v1.2.0 — Next (April 2026 CWL Season)
  ☐ TH18 scoring calibration review
  ☐ Performance improvements if identified
  ☐ Bug fixes from live CWL usage

Future
  ☐ Public server (bypass IP-whitelisted API key restriction)
  ☐ Offline mode / service worker
  ☐ Multi-clan support
```

---

## Documentation Standards

### Per-Feature
- **Before coding:** Write `docs/features/<name>/design.md`
- **After coding:** Write `docs/features/<name>/implementation.md`

### Per-Release
- Create `docs/changelogs/vX.Y.Z.md`
- Update `docs/changelogs/CHANGELOG.md` (append at top)

### Per-Decision
- Add entry to `docs/architecture/decisions.md` in ADR format

### Code-Level
- Every file gets a header comment block
- Every function gets a JSDoc block
- Every non-obvious line gets an inline comment
- All IPC handlers documented with request/response shape

---

## File Map

```
docs/
├── README.md                              ← THIS FILE
├── architecture/
│   ├── overview.md                        ← System diagram, module responsibilities
│   ├── data-flow.md                       ← End-to-end data flow (API → state → UI)
│   └── decisions.md                       ← ADRs for all major decisions
├── changelogs/
│   ├── CHANGELOG.md                       ← Running log
│   ├── v1.0.0.md                          ← Initial release
│   └── v1.1.0.md                          ← Current release notes
├── guides/
│   ├── local-setup.md                     ← How to run locally
│   └── api-token-setup.md                 ← How to get and configure CoC API token
├── deep-dives/
│   └── scoring-algorithm.md               ← First-principles breakdown of the scoring math
└── features/
    ├── scoring-algorithm/
    │   └── implementation.md              ← Technical record of algorithm decisions
    ├── api-integration/
    │   └── implementation.md              ← CoC API usage, endpoints, error handling
    ├── bonus-distribution/
    │   └── implementation.md              ← How bonuses are counted and assigned
    ├── public-server/
    │   └── design.md                      ← Plan for bypassing IP-whitelisted API keys
    └── offline-mode/
        └── design.md                      ← Plan for offline-first functionality
```
```

---

### Step 1.3 — Create `docs/architecture/overview.md`

```markdown
# CWL Performance Tracker — Architecture Overview

**Last Updated:** 2026-03-30
**Version:** 1.1.0

---

## Process Architecture (Electron)

Electron runs two separate processes. They cannot call each other directly —
all communication goes through the IPC bridge.

```
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS (main.js)                      │
│                    Node.js — full OS access                       │
│                                                                   │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐ │
│  │   CoC API Calls      │   │        File System I/O           │ │
│  │  (https module)      │   │  (fs.readFileSync/writeFileSync) │ │
│  │                      │   │                                  │ │
│  │ /v1/clans/{tag}      │   │  api_config.json → API token     │ │
│  │ /currentwar/league.. │   │  dialog.showSaveDialog → export  │ │
│  │ /clanwarleagues/wars │   │  dialog.showOpenDialog → import  │ │
│  └──────────────────────┘   └──────────────────────────────────┘ │
│                                                                   │
│  IPC Handlers:                                                    │
│    ipcMain.handle('fetch-clan-data', ...)                        │
│    ipcMain.handle('export-data', ...)                            │
│    ipcMain.handle('import-data', ...)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │ contextBridge (preload.js)
                             │ window.api.fetchClanData()
                             │ window.api.exportData()
                             │ window.api.importData()
┌────────────────────────────▼────────────────────────────────────┐
│                   RENDERER PROCESS (Browser)                      │
│                                                                   │
│  renderer.js (entry point)                                        │
│  └── js_modules/                                                  │
│      ├── config.js      ← constants (TH map, leagues, keys)      │
│      ├── calculator.js  ← scoring algorithm                       │
│      ├── state.js       ← all state + computeAll()               │
│      ├── events.js      ← all DOM event listeners                 │
│      └── ui/                                                      │
│          ├── dom.js          ← cached DOM refs                    │
│          ├── components.js   ← toast, modal, tooltip              │
│          ├── main_view.js    ← renders both tables                │
│          ├── modal_attackdata_editor.js                           │
│          ├── modal_lineup_editor.js                               │
│          └── th_selector.js                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Responsibilities

| Module | What It Owns | What It Must NOT Do |
|---|---|---|
| `main.js` | API calls, file I/O, IPC handlers | Touch the DOM, import renderer modules |
| `preload.js` | contextBridge surface only | Business logic, direct DOM access |
| `renderer.js` | App initialization only | Business logic (delegate to modules) |
| `config.js` | Constants only | State, side effects |
| `calculator.js` | Score math only | State mutations, DOM, API calls |
| `state.js` | All state + computeAll | Direct DOM manipulation (delegate to ui/) |
| `events.js` | DOM event wiring only | State logic (delegate to state.js) |
| `ui/dom.js` | DOM ref cache only | Logic, event handling |
| `ui/components.js` | Reusable UI primitives | App-specific business logic |
| `ui/main_view.js` | Table rendering | State mutations |

---

## Data Storage

| What | Where | Format | Persists |
|---|---|---|---|
| Player roster + war data | `localStorage` | JSON | Yes — survives app restart |
| App settings | `localStorage` | JSON | Yes |
| API token | `api_config.json` | JSON | Yes — local file, never committed |
| Exported snapshots | User-chosen file | JSON | Yes — manual save |
| Computed scores | `player.__computed` | JS object | No — recalculated on every `computeAll()` |

---

## Key Design Patterns

### Computed Properties Pattern
Scores are never stored — they are always recalculated fresh by `computeAll()`.
`player.__computed` is a temporary object that gets wiped and rebuilt on every call.
This prevents stale score data surviving between sessions.

### Data Freeze Safeguard
`processApiData()` in `state.js` checks if the API returns empty/error data while
local data already exists. If so, it ABORTS the update to protect cached data.
This prevents a mid-season API outage from wiping your local war data.

### IPC Security Model
`nodeIntegration: false` and `contextIsolation: true` in `main.js` mean the renderer
has zero direct Node.js access. All privileged operations go through the
`contextBridge` in `preload.js`, which exposes only three named functions.
```

---

### Step 1.4 — Create `docs/architecture/data-flow.md`

```markdown
# CWL Performance Tracker — Data Flow

End-to-end trace of how data moves through the system.

---

## Flow 1: Fetching Clan Data (Main Path)

```
User types clan tag → clicks "Fetch War Data"
  ↓
events.js → handleApiFetch()
  ↓
window.api.fetchClanData(clanTag)  ← crosses IPC bridge via preload.js
  ↓
main.js → ipcMain.handle('fetch-clan-data')
  ↓
API Call 1: GET /v1/clans/{tag}            → clanInfo (name, badge, league, memberList)
API Call 2: GET /v1/clans/{tag}/currentwar/leaguegroup → cwlGroupInfo (rounds, war tags)
API Calls 3-9: GET /v1/clanwarleagues/wars/{warTag}    → warDetails[0..6]
  (fetched in parallel per round using Promise.all)
  ↓
{ success: true, data: { clanInfo, warDetails, cwlError, cwlMasterRoster } }
  ↓ crosses IPC bridge back to renderer
events.js → processApiData(result.data)
  ↓
state.js → processApiData()
  - Builds player objects from clanInfo.memberList
  - Maps each player's war data from warDetails[0..6]
  - Identifies CWL roster members (cwlMasterRoster set)
  - Sets currentLiveDayIndex (which war is currently 'inWar')
  - Calls saveAppState() → localStorage
  - Calls computeAll()
  ↓
state.js → computeAll()
  - Auto-calculates warsWon from warDetails states
  - Auto-calculates cwlFinished (7 wars started)
  - Auto-calculates bonusCount (leagueBase + warsWon)
  - Calculates performance scores for every player/war via calculator.js
  - Sorts players and assigns ranks
  - Calls renderPlayersTable() + renderRankingsTable()
  ↓
ui/main_view.js → DOM updated
```

---

## Flow 2: Scoring a Single Attack

```
player object + warData object
  ↓
calculator.js → calculatePerformanceScore(player, warData)
  ↓
1. Guard: if player not in lineup → return null
2. Guard: if attack missed → return -20 (flat penalty)
3. Base score from stars: 1★=40, 2★=70, 3★=80
4. Destruction bonus: destructionPercentage × 0.2
5. baseAttackScore = starScore + destructionBonus
6. attackerPPS = getPlayerStrength(player.th, warData.myPosition)
7. defenderPPS = getPlayerStrength(warData.opponentTh, warData.opponentPosition)
8. difficultyMultiplier = defenderPPS / attackerPPS
9. finalScore = baseAttackScore × difficultyMultiplier
  ↓
score returned to state.js → stored in player.__computed.warScores[i]
```

---

## Flow 3: Save / Load

### Save (Export)
```
User clicks "Save" button
  ↓
events.js → exportData()
  ↓
state.js → exportData()
  - Strips __computed from all players (computed data is not saved)
  - Serializes full state to JSON string
  ↓
window.api.exportData(jsonString) ← crosses IPC bridge
  ↓
main.js → dialog.showSaveDialog() → fs.writeFileSync()
```

### Load (Import)
```
User clicks "Load" button
  ↓
window.api.importData() ← crosses IPC bridge
  ↓
main.js → dialog.showOpenDialog() → fs.readFileSync()
  ↓ crosses IPC bridge back
state.js → importData()
  - Parses JSON
  - Restores all state variables
  - Ensures all players have valid war arrays (backfills if needed)
  - Calls saveAppState() → localStorage
  - Calls computeAll() → re-renders UI
```

---

## Flow 4: Auto-Refresh

```
User sets auto-refresh interval in Settings
  ↓
events.js → setupAutoRefresh(minutes)
  - Clears existing interval timer
  - Sets new setInterval → calls handleApiFetch() every N minutes
  - handleApiFetch() with isBackground=true (silent toast)
```

---

## localStorage Key Map

| Key | Content | Set By |
|---|---|---|
| `cwl_players_v5` | Full player array (no __computed) | state.js → saveAppState() |
| `cwl_war_details` | Raw war data from API | state.js → saveAppState() |
| `cwl_settings_v1` | appSettings object | state.js → saveAppState() |
| `cwl_league_id` | Selected league ID string | state.js → saveAppState() |
| `cwl_war_format` | 15 or 30 | state.js → saveAppState() |
| `cwl_live_day_index` | Index of currently live war | state.js → saveAppState() |
| `cwl_clan_meta` | Clan name, badge URL, league name | state.js → saveAppState() |
| `cwl_clan_tag` | Last used clan tag | state.js → saveAppState() |
```

---

### Step 1.5 — Create `docs/architecture/decisions.md`

```markdown
# CWL Performance Tracker — Architecture Decision Records

Add a new entry for every significant technical decision made.

---

## ADR-001 — Use Electron for the desktop app

**Date:** 2025 (initial build)
**Status:** Active

**Decision:** Build as an Electron desktop app rather than a web app.

**Context:** The CoC API requires IP-whitelisted API keys. A web server would
expose the key. A desktop app keeps the key local on the user's machine.

**Alternatives considered:**
- Pure web app — API key would be in the frontend bundle, accessible to anyone
- Node.js CLI — no GUI, poor UX for a data-heavy ranking tool
- Native app (Swift/Kotlin) — too much overhead for a personal tool

**Reasoning:** Electron gives a full desktop GUI with Node.js backend, keeping
the API key secure in a local `api_config.json` file.

**Consequences:** App must be installed and run locally. Cannot be shared as a
URL. This is the core blocker for the public server feature (see ADR-005).

---

## ADR-002 — Never store computed scores in localStorage

**Date:** 2025
**Status:** Active

**Decision:** `player.__computed` is always recalculated fresh by `computeAll()`.
It is explicitly stripped before any save/export operation.

**Context:** Storing computed scores risks stale data. If the algorithm changes
(e.g., new TH level added, weight adjusted), stored scores would be wrong.

**Reasoning:** Scores are cheap to compute (pure math, no network). Recomputing
on every load guarantees correctness. The source of truth is raw attack data, not scores.

**Consequences:** Every app load triggers a full score recalculation. This is
intentional and acceptable given the dataset size (max ~50 players × 7 wars).

---

## ADR-003 — Data freeze safeguard in processApiData()

**Date:** 2025
**Status:** Active

**Decision:** If the API returns empty or error data while local data already
exists, abort the update entirely and keep the cached data.

**Context:** During a live CWL season, a mid-season API outage or a "not in CWL"
error would wipe all local war data if processed naively.

**Reasoning:** Local data is more valuable than a failed API response. The user
can always manually refresh once the API recovers.

**Consequences:** If a user genuinely changes clans mid-season, they must manually
reset data before fetching the new clan. This is an acceptable tradeoff.

---

## ADR-004 — TH strength values are manually calibrated constants

**Date:** 2025
**Status:** Active (review at each new TH release)

**Decision:** `TH_STRENGTH_MAP` in `config.js` uses manually tuned values rather
than a formula.

**Context:** There is no official "difficulty rating" from Supercell. The values
needed to reflect real-world attack difficulty, not just TH number progression.

**Reasoning:** A linear formula (TH × constant) does not reflect the actual gap
between town hall levels. TH16→17→18 gaps are different from TH9→10→11 gaps.
Manual calibration against real CWL data produces more accurate results.

**Consequences:** Values must be reviewed and updated whenever a new TH level is
released. See `docs/deep-dives/scoring-algorithm.md` for the full derivation.

---

## ADR-005 — API token stored in api_config.json (not env vars)

**Date:** 2025
**Status:** Active

**Decision:** API token lives in `api_config.json` at the project root, read by
`main.js` at startup. This file is NOT committed to Git.

**Context:** Electron apps don't have a standard `.env` file convention like
web apps. The token must survive app restarts and be easy to update.

**Alternatives considered:**
- Environment variables — awkward to set for non-developer users
- Hardcoded in main.js — would be committed to Git
- OS keychain — complex implementation for minimal gain on a personal app

**Reasoning:** A local JSON file is the simplest approach for a single-user
desktop app. The file is gitignored so it never reaches the repo.

**Consequences:** New users must create `api_config.json` manually.
See `docs/guides/api-token-setup.md` for instructions.

---

## ADR-006 — Use Promise.all for fetching war details per round

**Date:** 2025
**Status:** Active

**Decision:** Each CWL round can have multiple war tags. These are fetched in
parallel using `Promise.all` rather than sequentially.

**Context:** A 15v15 CWL has 8 clans and 4 wars per round. Fetching all 4 war
tags for a round sequentially would multiply latency unnecessarily.

**Reasoning:** The war tag requests are independent — no request depends on the
result of another. Parallel fetching reduces round fetch time by ~4x.

**Consequences:** If one war tag request fails, `Promise.all` rejects the entire
round. This is handled by the outer try/catch which falls back to cwlError.

---

## [TEMPLATE FOR NEW ADRs]

## ADR-00X — Title

**Date:** YYYY-MM-DD
**Status:** Active | Superseded | Deprecated

**Decision:** One sentence.

**Context:** Why did this decision need to be made?

**Alternatives considered:**
- Option A — why rejected
- Option B — why rejected

**Reasoning:** Why this option won.

**Consequences:** What does this commit us to?
```

---

### Step 1.6 — Create `docs/deep-dives/scoring-algorithm.md`

```markdown
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
```

---

### Step 1.7 — Create `docs/guides/local-setup.md`

```markdown
# CWL Performance Tracker — Local Setup Guide

---

## Prerequisites

- **Node.js** v18 or newer — [nodejs.org](https://nodejs.org)
- A **Clash of Clans API token** — [developer.clashofclans.com](https://developer.clashofclans.com)
- Your **IP address must be whitelisted** on the API token (see api-token-setup.md)

---

## Steps

### 1. Clone the repository

```bash
git clone https://github.com/sobanali2006/CWL-Bonus-Distr.git
cd CWL-Bonus-Distr
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `api_config.json`

Create a file named `api_config.json` in the project root:

```json
{
  "apiToken": "your_api_token_here"
}
```

> ⚠️ This file is gitignored. Never commit it. It contains your API key.
> See `docs/guides/api-token-setup.md` for how to get a token.

### 4. Start the app

```bash
npm start
```

---

## Common Issues

| Problem | Fix |
|---|---|
| `CRITICAL: Could not read api_config.json` | Create the file as shown in Step 3 |
| `Access Denied (403)` on fetch | Your IP is not whitelisted on the API token |
| `Clan tag not found (404)` | Double-check the clan tag — must start with # |
| App window appears but data doesn't load | Open DevTools (uncomment line in main.js) to check console errors |
| Blank screen on startup | Run `npm install` again, check Node.js version |

---

## Enabling DevTools

In `main.js`, uncomment this line:

```javascript
// win.webContents.openDevTools();
```

This opens the Chrome DevTools panel for the renderer process.
```

---

### Step 1.8 — Create `docs/guides/api-token-setup.md`

```markdown
# CoC API Token Setup

The app requires an API token from the official Clash of Clans developer portal.
This token is IP-whitelisted — it only works from the IP address you register it on.

---

## Steps

### 1. Get your current IP address

Visit [whatismyip.com](https://whatismyip.com) and note your IPv4 address.

> ⚠️ If you're on a dynamic IP (most home connections), your IP changes periodically.
> You'll need to create a new token (or update the whitelist) when it changes.
> This is the core limitation driving the public server feature plan.

### 2. Create a developer account

Go to [developer.clashofclans.com](https://developer.clashofclans.com) and sign in
with your Supercell ID.

### 3. Create an API key

- Click "My Account" → "Create New Key"
- Name: anything (e.g., "CWL Tracker Local")
- Description: optional
- Allowed IP addresses: paste your current IP

### 4. Copy the token

Copy the generated token string.

### 5. Add to api_config.json

```json
{
  "apiToken": "paste_your_token_here"
}
```

---

## What happens when your IP changes?

The API will return a 403 (Access Denied) error. You need to:
1. Go back to developer.clashofclans.com
2. Delete the old key
3. Create a new key with your new IP
4. Update `api_config.json`

This is why the public server feature is a planned improvement — it routes API calls
through a server with a static IP so users don't need their own tokens.
See `docs/features/public-server/design.md`.
```

---

### Step 1.9 — Create `docs/changelogs/CHANGELOG.md`

```markdown
# CHANGELOG

All notable changes to CWL Performance Tracker.
Format follows [Keep a Changelog](https://keepachangelog.com).
Versions follow [Semantic Versioning](https://semver.org).

---

## [1.1.0] — 2026-03-30

### Added
- TH18 support in scoring algorithm and TH selector
- Automated wars won + CWL finished detection (no longer manual)
- Automated bonus count calculation from league + wins
- Season summary card (auto-shown when CWL ends, replaces manual controls)
- Traffic light status indicators in lineup viewer (green/red/white per attack)
- Hide Non-CWL members toggle
- Hide Bench players toggle
- CWL master roster tracking (identifies which members are in the CWL season)
- Data freeze safeguard (protects local data from API outages)
- Documentation infrastructure (docs/ directory, agent instructions)

### Fixed
- TH selector now starts at TH18 (previously started lower)
- War day lineup correctly shows enemy lineup hidden during preparation day

---

## [1.0.0] — 2025

### Added
- Electron desktop app with CoC REST API integration
- Custom weighted performance scoring algorithm
- 15v15 and 30v30 war format support
- Per-player attack data editor modal
- War day lineup viewer (clan vs enemy)
- Manual wars won + bonus distribution controls
- Save / Load JSON export via native file dialogs
- Auto-refresh with configurable interval
- Settings sidebar (decimal places, best attacks average)
- localStorage persistence between sessions
```

---

### Step 1.10 — Create `docs/changelogs/v1.1.0.md`

```markdown
# Release Notes — v1.1.0

**Date:** 2026-03-30
**Type:** Feature release + documentation infrastructure

---

## Summary

This release adds TH18 support, automates several previously-manual calculations
(wars won, CWL status, bonus count), adds quality-of-life UI improvements, and
establishes the full documentation and agent instruction system.

---

## Changes

### TH18 Support
- Added TH18 to `TH_STRENGTH_MAP` with value 35
- Updated TH selector loop to start at 18
- Scoring algorithm now correctly handles TH18 attackers and defenders

### Automated Calculations
- **Wars Won:** Now auto-calculated from `warDetails` state values
- **CWL Finished:** Auto-detected when 7 wars have started/ended
- **Bonus Count:** Auto-calculated as `leagueBase + warsWon`
- Manual controls remain as fallback when API data is unavailable

### Season Summary Card
- Automatically replaces manual war controls when CWL is detected as finished
- Shows: League name, Win/Loss record, Bonuses available

### Traffic Light Indicators
- Green circle = attacked
- Red circle = missed
- White circle = pending (in lineup, not yet attacked)
- Shown per player in the war day lineup viewer

### Filtering
- "Hide Non-CWL" toggle: removes non-rostered members from the table
- "Hide Bench" toggle: removes players with 0 participations (or 0 for active day)

### Data Protection
- Safeguard added to `processApiData()`: if API returns empty/error but local
  data exists, the update is aborted to preserve cached data

### Documentation
- Full `docs/` directory structure created
- `AGENT_INSTRUCTIONS.md` and `AGENT_RULES.md` added to project root
- Architecture, data flow, decisions, deep-dives, and guides all documented

---

## Files Modified

| File | What Changed |
|---|---|
| `js_modules/config.js` | Added TH18 to strength map |
| `js_modules/calculator.js` | Handles TH18 in score calculation |
| `js_modules/state.js` | Auto wins/finished/bonus, data freeze safeguard, clanMeta |
| `js_modules/events.js` | Hide toggles wired up |
| `js_modules/ui/main_view.js` | Season summary card, traffic lights, filtering |
| `js_modules/ui/modal_lineup_editor.js` | Traffic light status, preparation day handling |
| `js_modules/ui/th_selector.js` | Loop starts at TH18 |
| `main.js` | cwlMasterRoster extraction and passing to renderer |
```

---

### Step 1.11 — Create `docs/features/public-server/design.md`

```markdown
# Feature Design — Public Server

**Status:** Planned (future)
**Blocker:** IP-whitelisted API key requirement

---

## Problem

The CoC API requires each token to be registered to a specific IP address.
This means every user needs to:
1. Create their own developer account
2. Get their own API token
3. Whitelist their own IP
4. Update the token whenever their IP changes

This is a significant barrier to sharing the app with other clan leaders.

---

## Goal

Allow users to use the app without their own API token by routing requests
through a server with a static, whitelisted IP.

---

## Architecture Options

### Option A — Simple Proxy Server
A lightweight Node.js/Express server that:
- Accepts clan tag from the client
- Makes the CoC API call using a server-side token
- Returns the response

**Pros:** Simple, cheap to host (Render free tier, Railway, etc.)
**Cons:** Server goes down = app breaks for all users. Rate limiting risks.

### Option B — Serverless Functions (Recommended)
Host API proxy functions on Vercel/Netlify/Cloudflare Workers:
- No server to manage
- Auto-scales
- Free tier likely sufficient
- Each function = one API endpoint

**Implementation:**
```
User App → POST https://your-worker.workers.dev/api/clan
  ↓
Cloudflare Worker → CoC API (using server-stored token)
  ↓
Response → User App
```

### Option C — Supabase Edge Functions
If Supabase is ever added for other features, Edge Functions could host the proxy.

---

## Security Considerations

- The server-side API token must be in environment variables, never in code
- Rate limiting must be implemented to prevent abuse
- Consider requiring a simple passphrase to prevent public misuse

---

## Open Questions

1. Which hosting platform? (Cloudflare Workers recommended for free tier + performance)
2. Rate limiting strategy? (Per-IP? Per clan tag? Per session?)
3. Should the Electron app fall back to local token if server is unavailable?
4. Is a passphrase sufficient, or do we need user accounts?
```

---

### Step 1.12 — Create `docs/features/scoring-algorithm/implementation.md`

```markdown
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
```

---

## PART 2 — CODE COMMENTING STANDARDS

Apply these rules to every source file. Same format as AGENT_INSTRUCTIONS.md for FinTrack.

---

### Commenting Rule 1 — File Header Block

Every `.js` file must start with:

```javascript
/**
 * FILE: filename.js
 * PROCESS: Main | Renderer  (Electron process this runs in)
 * ROLE: One sentence — what is this file responsible for?
 *
 * DEPENDENCIES:
 *   - import/require name: why it's needed
 *
 * EXPORTS:
 *   - functionName(): one-line description
 *
 * IPC: (only for main.js and preload.js)
 *   - Handles: 'channel-name' — what it does
 *   - Exposes: window.api.methodName() — what it does
 *
 * DOCS:
 *   - docs/path/to/relevant-doc.md
 */
```

---

### Commenting Rule 2 — Function Block

```javascript
/**
 * FUNCTION: functionName
 * PURPOSE: What it does and why it exists.
 *
 * @param paramName - What it is, valid values, where it comes from
 * @returns What comes back
 *
 * CALLED BY: file.js → callerName
 * CALLS: otherFunction(), ipcRenderer.invoke(), etc.
 *
 * SIDE EFFECTS:
 *   - State mutations, DOM updates, localStorage writes, IPC calls
 *
 * ERROR HANDLING:
 *   - What happens on failure
 *
 * SEE ALSO: docs/path/to/doc.md
 */
```

---

### Step 2.1 — Comment `main.js`

Apply file header, then JSDoc to:
- `apiRequest()` — explain the Promise wrapper, statusCode handling, reject shape
- `createWindow()` — explain BrowserWindow options, especially security settings
- `ipcMain.handle('fetch-clan-data')` — explain all 3 API calls, Promise.all pattern,
  cwlMasterRoster extraction, data normalization (swap clan/opponent if needed)
- `ipcMain.handle('export-data')` — explain dialog options, fs.writeFileSync
- `ipcMain.handle('import-data')` — explain dialog options, fs.readFileSync

Inline comments must explain:
- Why `ignore-certificate-errors` is set
- Why `contextIsolation: true` and `nodeIntegration: false`
- The clan/opponent swap logic (why it exists)
- The cwlMasterRoster extraction logic

---

### Step 2.2 — Comment `preload.js`

Apply file header explaining the contextBridge security model.
Each exposed function needs a comment explaining:
- What channel it invokes
- What data shape it sends
- What data shape it receives back

---

### Step 2.3 — Comment `js_modules/config.js`

Apply file header. Then comment:
- Each `LEAGUES` entry: what `base` means (league bonus base count)
- `TH_STRENGTH_MAP`: explain each value cluster and why gaps exist
- `POINTS_BUFFER`: explain why 100 was chosen
- `localStorageKey`: explain the `_v5` versioning convention
- All localStorage key constants: what each one stores

---

### Step 2.4 — Comment `js_modules/calculator.js`

This is the most important file to comment. Apply file header, then:

```javascript
/**
 * FUNCTION: getPlayerStrength
 * PURPOSE: Computes the Player Position Strength (PPS) for a given TH level
 *          and war position. Used as both attacker and defender strength
 *          in the difficulty multiplier calculation.
 *
 * @param th - Town Hall level (1-18). From player.th or warData.opponentTh.
 * @param position - War map position (1 = top, warFormat = bottom).
 *                   Position 1 gets maximum rank points.
 * @returns PPS score (float). Returns 0 if th or position is 0 (invalid).
 *
 * FORMULA:
 *   rankPoints = ((warFormat + 1 - position) / warFormat) × 65
 *   thPoints = TH_STRENGTH_MAP[th]
 *   PPS = rankPoints + thPoints + POINTS_BUFFER
 *
 * POINTS_BUFFER (100) prevents extreme multiplier ratios when comparing
 * very low-TH players. Without it, TH5 vs TH18 would produce
 * an unrealistically large difficulty multiplier.
 *
 * CALLED BY: calculator.js → calculatePerformanceScore() (twice per attack)
 * SEE ALSO: docs/deep-dives/scoring-algorithm.md → Component Breakdown
 */
```

And for `calculatePerformanceScore`:

```javascript
/**
 * FUNCTION: calculatePerformanceScore
 * PURPOSE: Computes a difficulty-adjusted performance score for a single attack.
 *          Accounts for stars, destruction %, and relative attacker/defender strength.
 *
 * @param player - Full player object. Needs player.th and player's war position.
 * @param warData - Single war entry from player.wars[dayIndex]:
 *                  { myPosition, opponentTh, opponentPosition, stars, destruction, status }
 * @returns Score (float), -20 (missed penalty), 0 (bench/invalid), or null (not scorable)
 *
 * SCORING FORMULA:
 *   baseScore = starScore + (destruction × 0.2)
 *   starScore: 1★=40, 2★=70, 3★=80 (non-linear — see deep-dive)
 *   finalScore = baseScore × (defenderPPS / attackerPPS)
 *
 * SPECIAL CASES:
 *   - myPosition === 0: player not in lineup → return null
 *   - status === 'missed': flat -20 penalty → return -20
 *   - attackerPPS or defenderPPS === 0: invalid data → return 0
 *
 * CALLED BY: state.js → computeAll() (for each player × war)
 *            ui/modal_attackdata_editor.js → createWarRowDisplay() (for display)
 * SEE ALSO: docs/deep-dives/scoring-algorithm.md
 */
```

---

### Step 2.5 — Comment `js_modules/state.js`

Apply file header. Comment every state variable declaration:

```javascript
// Full player roster. Each player has: id, name, th, clanRank, isCwlMember,
// wars[0..6], isBonusGiven, __computed (temporary, never saved).
let players = [];

// Raw war data from API for all 7 rounds. warDetails[i] is the war object
// for day i, or null if the round hasn't been fetched yet.
let cwlWarDetails = [];

// Auto-calculated in computeAll(). True when 7 wars have started/ended.
// Triggers the season summary card UI and bonus checkbox display.
let cwlFinished = false;
```

JSDoc every exported function. Pay special attention to `computeAll()` —
add section headers as inline comments for each of the 3 phases:

```javascript
// ─── PHASE 1: AUTO-CALCULATE WARS WON + SEASON STATUS ───────────────────────
// ─── PHASE 2: AUTO-CALCULATE BONUS COUNT ─────────────────────────────────────
// ─── PHASE 3: CALCULATE PERFORMANCE SCORES FOR ALL PLAYERS ───────────────────
```

---

### Step 2.6 — Comment `js_modules/events.js`

Apply file header. Comment:
- `refreshTimer` variable — explain it's a setInterval handle, cleared on each setup
- `updateFetchButtonState()` — explain the three button states (disabled, Import, Refresh)
- `setupAutoRefresh()` — explain the clearInterval pattern
- `handleApiFetch()` — explain isBackground parameter and isImport detection
- `handleGlobalKeydown()` — explain the modal stack traversal logic

---

### Step 2.7 — Comment all `js_modules/ui/` files

**dom.js:** Add a comment above each DOM ref group:
```javascript
// ── API Controls ──────────────────────────────────────────────────────────────
// ── Main Tables ───────────────────────────────────────────────────────────────
// ── Settings Sidebar ──────────────────────────────────────────────────────────
// ── Modals ────────────────────────────────────────────────────────────────────
```

**components.js:** Comment the toast state machine (currentToastElement, currentToastTimer),
the force-reflow trick (`void toast.offsetWidth`), and the modal open/close pattern.

**main_view.js:** Comment the `renderRankingsTable()` season summary card logic,
the bonus checkbox enable/disable logic, and the `renderPlayersTable()` filter chain.

**modal_attackdata_editor.js:** Comment the `createWarRowDisplay()` state machine
(all the if/else branches for warState × playerStatus combinations).

**modal_lineup_editor.js:** Comment the `getLineupForDay()` API vs fallback priority,
the preparation day detection, and the traffic light status logic.

---

## PART 3 — COMMIT SEQUENCE

```bash
# Commit 1: Directory skeleton
git add docs/
git commit -m "docs: initialize documentation directory structure"

# Commit 2: Architecture docs
git commit -m "docs: add architecture overview, data flow, and decisions log"

# Commit 3: Deep dive
git commit -m "docs: add scoring algorithm deep dive"

# Commit 4: Guides
git commit -m "docs: add local setup and API token setup guides"

# Commit 5: Changelogs + feature docs
git commit -m "docs: add changelogs and feature design/implementation docs"

# Commit 6+: Code comments (one per file)
git commit -m "docs(main): add inline comments and IPC documentation"
git commit -m "docs(calculator): add JSDoc and scoring formula comments"
git commit -m "docs(state): add inline comments to computeAll and processApiData"
git commit -m "docs(config): add comments to TH strength map and league constants"
git commit -m "docs(events): add inline comments to all event handlers"
git commit -m "docs(ui): add inline comments to all UI modules"
```

---

## PART 4 — ONGOING RULES

Every time you make any change to this project:

1. **Read the relevant doc first.** Check `docs/features/` before writing code.
2. **Comment every function you write or modify.** Use the JSDoc format above.
3. **Comment every IPC call.** Explain the channel, request shape, response shape.
4. **Comment every localStorage read/write.** State which key and what it stores.
5. **Never use sequential awaits for independent requests.** Use `Promise.all`.
6. **Never mutate `player.__computed` outside of `computeAll()`.** It's a computed cache.
7. **Update `docs/architecture/decisions.md`** for every significant tech choice.
8. **Update `docs/changelogs/CHANGELOG.md`** when a feature is complete.
9. **Update `TH_STRENGTH_MAP` comments** when new TH levels are added.
10. **Never commit `api_config.json`.** Verify it is in `.gitignore`.
11. **Test the data freeze safeguard** after any changes to `processApiData()`.
12. **Update `docs/deep-dives/scoring-algorithm.md`** if the formula changes.

---

*End of Agent Instructions — CWL Performance Tracker v1.1.0*
