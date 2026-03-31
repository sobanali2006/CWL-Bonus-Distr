/**
 * FILE: preload.js
 * PROCESS: Main (runs in a sandboxed context before the renderer loads)
 * ROLE: Secure IPC bridge — exposes a minimal, named API surface to the renderer
 *       via contextBridge. The renderer has NO direct Node.js or Electron access.
 *
 * SECURITY MODEL:
 *   main.js sets contextIsolation: true and nodeIntegration: false.
 *   This file is the ONLY connection between the two worlds.
 *   window.api.* functions are the complete list of privileged operations
 *   available to the renderer — nothing more, nothing less.
 *
 * DEPENDENCIES:
 *   - contextBridge: Safely exposes functions to the renderer world
 *   - ipcRenderer: Sends messages to ipcMain handlers in main.js
 *
 * EXPORTS (via window.api):
 *   - fetchClanData(clanTag): Trigger CoC API fetch in main process
 *   - exportData(data): Save JSON data to a user-chosen file
 *   - importData(): Open a file picker and return its content
 *
 * IPC:
 *   - Exposes: window.api.fetchClanData() → invokes 'fetch-clan-data'
 *   - Exposes: window.api.exportData()    → invokes 'export-data'
 *   - Exposes: window.api.importData()    → invokes 'import-data'
 *
 * DOCS:
 *   - docs/architecture/overview.md → IPC Security Model
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /**
   * FUNCTION: fetchClanData
   * PURPOSE: Sends a clan tag to the main process, which makes all CoC API calls
   *          and returns the combined result.
   *
   * @param clanTag - Clan tag string (e.g. '#2PP'). Leading # is optional.
   * @returns Promise resolving to:
   *   { success: true,  data: { clanInfo, warDetails, cwlError, cwlMasterRoster } }
   *   { success: false, error: string }
   *
   * CALLED BY: events.js → handleApiFetch()
   * INVOKES IPC: 'fetch-clan-data' in main.js
   */
  fetchClanData: (clanTag) => ipcRenderer.invoke('fetch-clan-data', clanTag),

  /**
   * FUNCTION: exportData
   * PURPOSE: Sends pre-serialized JSON to the main process, which opens a Save
   *          dialog and writes the data to a user-chosen file path.
   *
   * @param data - JSON string (already serialized by state.js → exportData(),
   *               with __computed stripped from all players)
   * @returns Promise resolving to:
   *   { success: true, path: string }  — file written at path
   *   { success: false }               — user cancelled
   *   { success: false, error: string } — write error
   *
   * CALLED BY: state.js → exportData()
   * INVOKES IPC: 'export-data' in main.js
   */
  exportData: (data) => ipcRenderer.invoke('export-data', data),

  /**
   * FUNCTION: importData
   * PURPOSE: Asks the main process to open a file picker dialog. Returns the raw
   *          UTF-8 content of the selected file as a string. Parsing happens in
   *          state.js → importData().
   *
   * @returns Promise resolving to:
   *   { success: true, data: string }  — file content as UTF-8 string
   *   { success: false }               — user cancelled
   *   { success: false, error: string } — read error
   *
   * CALLED BY: state.js → importData()
   * INVOKES IPC: 'import-data' in main.js
   */
  importData: () => ipcRenderer.invoke('import-data')
});