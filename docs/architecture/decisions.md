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
