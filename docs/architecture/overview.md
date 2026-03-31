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
