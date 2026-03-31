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
