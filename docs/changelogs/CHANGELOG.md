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
