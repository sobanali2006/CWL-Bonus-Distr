// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /**
   * Sends a clan tag to the main process to fetch all relevant CWL data.
   * @param {string} clanTag The clan tag to look up (e.g., '#2PP').
   * @returns {Promise<object>} A promise that resolves with the fetched data or an error.
   */
  fetchClanData: (clanTag) => ipcRenderer.invoke('fetch-clan-data', clanTag),

  /**
   * Sends data to the main process to be exported to a file.
   * @param {string} data The JSON string data to export.
   * @returns {Promise<object>} A promise that resolves with the result of the export operation.
   */
  exportData: (data) => ipcRenderer.invoke('export-data', data),
  
  /**
   * Asks the main process to open a file dialog and returns the content of the selected file.
   * @returns {Promise<object>} A promise that resolves with the imported data or an error.
   */
  importData: () => ipcRenderer.invoke('import-data')
});