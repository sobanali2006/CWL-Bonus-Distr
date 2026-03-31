/**
 * FILE: main.js
 * PROCESS: Main
 * ROLE: Electron main process — creates the app window, makes all CoC API HTTP
 *       requests, and handles save/load file dialogs via IPC handlers.
 *
 * DEPENDENCIES:
 *   - electron (app, BrowserWindow, ipcMain, dialog): Window management and IPC
 *   - path: Resolves file paths for preload script and api_config.json
 *   - fs: Reads api_config.json at startup; writes/reads JSON export files
 *   - https: Makes all CoC REST API requests (Node's built-in HTTPS module)
 *   - package.json: Provides productName and version for the window title
 *
 * IPC:
 *   - Handles: 'fetch-clan-data' — runs 3 tiers of API calls, returns clan + war data
 *   - Handles: 'export-data'     — opens Save dialog, writes JSON to user-chosen file
 *   - Handles: 'import-data'     — opens Open dialog, reads and returns file content
 *
 * DOCS:
 *   - docs/architecture/overview.md  → IPC Security Model
 *   - docs/architecture/data-flow.md → Flow 1: Fetching Clan Data
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const pkg = require('./package.json');

// ── API TOKEN LOAD ────────────────────────────────────────────────────────────
// Read the API token from a local config file at startup.
// The file is gitignored — see docs/guides/api-token-setup.md for instructions.
// If the file is missing or malformed, apiToken stays null and the IPC handler
// will return a meaningful error to the renderer rather than crashing.
let apiToken;
let proxyUrl = null;
try {
    const apiConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'api_config.json')));
    apiToken = apiConfig.apiToken;
    proxyUrl = apiConfig.proxyUrl || null;
} catch (error) {
    console.error("CRITICAL: Could not read api_config.json.");
    apiToken = null;
}

// ── CERTIFICATE BYPASS ───────────────────────────────────────────────────────
// The CoC API sometimes returns SSL certificate issues in certain network
// environments (e.g., behind a corporate proxy). This switch suppresses those
// errors so the app works on more networks. Acceptable risk for a personal tool.
app.commandLine.appendSwitch('ignore-certificate-errors');

// ── DEV HOT RELOAD ───────────────────────────────────────────────────────────
// electron-reloader watches for file changes and auto-restarts the app during
// development. The try/catch silently skips it in production where the package
// is not installed.
try {
  require('electron-reloader')(module);
} catch {}

/**
 * FUNCTION: createWindow
 * PURPOSE: Creates the main BrowserWindow with security-hardened webPreferences
 *          and loads index.html as the app shell.
 *
 * @returns void
 *
 * SIDE EFFECTS:
 *   - Creates Electron BrowserWindow
 *   - Loads index.html into the window
 *   - Sets window title from package.json
 *   - Hides the native menu bar
 *
 * SECURITY NOTES:
 *   - contextIsolation: true  — renderer JS cannot access Node.js APIs directly
 *   - nodeIntegration: false  — prevents renderer from requiring Node modules
 *   - All privileged access goes through preload.js contextBridge (see preload.js)
 *
 * SEE ALSO: docs/architecture/overview.md → IPC Security Model
 */
function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Secure IPC bridge
            contextIsolation: true,   // Renderer cannot access Node.js APIs
            nodeIntegration: false,   // Belt-and-suspenders with contextIsolation
        }
    });
    win.setTitle(`${pkg.productName} - v${pkg.version}`);
    win.setMenuBarVisibility(false); // Hide native menu bar for cleaner UI
    win.loadFile('index.html');
    // win.webContents.openDevTools(); // Uncomment for debugging (see docs/guides/local-setup.md)
}

// ── APP LIFECYCLE ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

// macOS: re-create window when dock icon is clicked and no windows are open
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Windows/Linux: quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ── IPC HANDLER: fetch-clan-data ──────────────────────────────────────────────

/**
 * IPC HANDLER: 'fetch-clan-data'
 * PURPOSE: Orchestrates all CoC API calls for a given clan tag. Returns
 *          a structured result the renderer uses to build the player roster.
 *
 * REQUEST:  clanTag (string) — e.g. '#2PP' (may or may not include leading #)
 * RESPONSE: { success: true,  data: { clanInfo, warDetails, cwlError, cwlMasterRoster } }
 *       OR: { success: false, error: string }
 *
 * API CALLS MADE (in order):
 *   1. GET /v1/clans/{tag}                          → clanInfo (name, badge, league, memberList)
 *   2. GET /v1/clans/{tag}/currentwar/leaguegroup   → cwlGroupInfo (rounds, war tags)
 *   3-9. GET /v1/clanwarleagues/wars/{warTag}       → individual war details per round
 *        (fetched in parallel per round via Promise.all — see ADR-006)
 *
 * DATA NORMALIZATION:
 *   The API returns war data from the perspective of "clan" and "opponent".
 *   If our clan is on the "opponent" side of a war object, the clan and opponent
 *   keys are swapped so downstream code always reads war.clan as OUR clan.
 *
 * SEE ALSO: docs/architecture/data-flow.md → Flow 1
 */
ipcMain.handle('fetch-clan-data', async (event, clanTag) => {
    if (!apiToken) {
        return { success: false, error: "API Token is not configured." };
    }

    // Normalize the tag: strip any leading # for URL use, keep full tag for matching
    const sanitizedTag = clanTag.replace('#', '');
    const ourClanFullTag = `#${sanitizedTag}`; // Used to identify our clan in API responses

    /**
     * FUNCTION: apiRequest
     * PURPOSE: Wraps Node's https.request in a Promise for async/await usage.
     *          Parses the response body as JSON and rejects with a structured
     *          error object (including statusCode) on non-2xx responses.
     *
     * @param options - Standard https.request options (hostname, path, method, headers)
     * @returns Promise<object> — parsed JSON response body
     *
     * ERROR SHAPE: { statusCode: number, message: string }
     *   - 403: IP not whitelisted or invalid token
     *   - 404: Resource not found (bad clan tag, war not active)
     *   - 500: Response could not be parsed as JSON
     */
    const apiRequest = (options) => {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        // Success — parse and resolve
                        try { resolve(JSON.parse(data)); } catch (e) { reject({ statusCode: 500, message: "Failed to parse API response." }); }
                    } else {
                        // API error — parse error body for a human-readable reason
                        try {
                            const errorJson = JSON.parse(data);
                            reject({ statusCode: res.statusCode, message: errorJson.reason || JSON.stringify(errorJson) });
                        } catch (e) {
                            reject({ statusCode: res.statusCode, message: `An unparseable error occurred (Status Code: ${res.statusCode})` });
                        }
                    }
                });
            });
            req.on('error', (error) => reject(error));
            req.end();
        });
    };

    /**
     * FUNCTION: apiRequestViaProxy
     * PURPOSE: Makes an HTTP request to the designated proxy server.
     *          The proxy server transparently forwards the request to CoC.
     */
    const apiRequestViaProxy = (pUrl, cocPath) => {
        return new Promise((resolve, reject) => {
            const cleanBase = pUrl.replace(/\/$/, '');
            const url = new URL(cleanBase + '/coc-proxy' + cocPath);
            
            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: 'GET'
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try { resolve(JSON.parse(data)); } catch (e) { reject({ statusCode: 500, message: "Failed to parse proxy response." }); }
                    } else {
                        try {
                            const errorJson = JSON.parse(data);
                            reject({ statusCode: res.statusCode, message: errorJson.error || errorJson.reason || JSON.stringify(errorJson) });
                        } catch (e) {
                            reject({ statusCode: res.statusCode, message: `Proxy returned unparseable error (Status Code: ${res.statusCode})` });
                        }
                    }
                });
            });
            req.on('error', (error) => reject({ statusCode: 502, message: error.message }));
            req.end();
        });
    };

    /**
     * FUNCTION: fetchData
     * PURPOSE: Attempts to fetch data using the Proxy if configured.
     *          Provides a silent fallback (Option A) to the local apiToken 
     *          if the proxy server is unreachable or offline. 
     *          Valid CoC API errors (404, 403) bubble up normally.
     */
    const fetchData = async (cocPath) => {
        if (proxyUrl) {
            try {
                return await apiRequestViaProxy(proxyUrl, cocPath);
            } catch (err) {
                // Fallback to local token if proxy fails entirely or returns 502 (Bad Gateway/Upstream failure)
                if (err.statusCode === 502 || err.statusCode === 500) {
                    console.warn(`Proxy failed for ${cocPath}. Falling back to local token. Error:`, err.message);
                } else {
                    throw err; // It's a real CoC API error (e.g. 404 Not Found), bubble it up
                }
            }
        }
        
        // Direct to CoC API (fallback or no proxy configured)
        return await apiRequest({
            hostname: 'api.clashofclans.com',
            path: cocPath,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });
    };

    // ── API CALL 1: CLAN INFO ───────────────────────────────────────────────
    // This call is mandatory — if it fails, we have no player roster at all.
    let clanInfo;
    try {
        clanInfo = await fetchData(`/v1/clans/%23${sanitizedTag}`); // %23 = URL-encoded #
    } catch (err) {
        // Map common status codes to user-friendly messages
        let errorMessage = "An unknown error occurred.";
        if (err.statusCode === 403) errorMessage = "Access Denied. Check your API token and IP address.";
        else if (err.statusCode === 404) errorMessage = "Clan tag not found. Please check the tag and try again.";
        else errorMessage = `API Error ${err.statusCode || ''}: ${err.message}`;
        return { success: false, error: errorMessage };
    }

    // ── API CALLS 2-9: CWL WAR DATA ────────────────────────────────────────
    // These calls may fail legitimately (clan not in CWL, off-season).
    // cwlError is set instead of returning a failure — the renderer can still
    // show the clan roster even if war data is unavailable.
    let cwlGroupInfo = null;
    let warDetails = [];
    let cwlError = null;
    let cwlMasterRoster = []; // Tags of all members in the CWL season roster

    try {
        // ── API CALL 2: CWL LEAGUE GROUP ─────────────────────────────────
        cwlGroupInfo = await fetchData(`/v1/clans/%23${sanitizedTag}/currentwar/leaguegroup`);

        // Extract the master CWL roster for our clan.
        // cwlGroupInfo.clans lists all 8 clans in the CWL group.
        // We find our clan and extract the member tags — this identifies which
        // clan members are officially rostered for this CWL season (vs. guests
        // or members who joined after the season started).
        if (cwlGroupInfo && cwlGroupInfo.clans) {
            const ourClanInGroup = cwlGroupInfo.clans.find(c => c.tag === ourClanFullTag);
            if (ourClanInGroup && ourClanInGroup.members) {
                cwlMasterRoster = ourClanInGroup.members.map(m => m.tag);
            }
        }

        // ── API CALLS 3-9: WAR DETAILS PER ROUND ─────────────────────────
        // Each CWL round has multiple war tags (one per war in that round).
        // We fetch them in parallel per round (Promise.all) then find the war
        // our clan is participating in — see ADR-006 for why parallel.
        if (cwlGroupInfo && cwlGroupInfo.rounds) {
            for (const round of cwlGroupInfo.rounds) {
                const validWarTags = round.warTags.filter(tag => tag && tag !== '#0');

                // '#0' means that round's war hasn't been scheduled yet
                if (validWarTags.length === 0) {
                    warDetails.push(null); // Placeholder to preserve round index alignment
                    continue;
                }

                // Fetch all war tags for this round in parallel
                const roundWarDetailsPromises = validWarTags.map(warTag => 
                    fetchData(`/v1/clanwarleagues/wars/%23${warTag.substring(1)}`) // strip leading #
                );

                const roundWarDetails = await Promise.all(roundWarDetailsPromises);

                // Find the war where our clan is either clan or opponent
                const ourWar = roundWarDetails.find(war => war.clan.tag === ourClanFullTag || war.opponent.tag === ourClanFullTag);

                if (ourWar) {
                    // NORMALIZATION: Ensure our clan is always in war.clan (never war.opponent).
                    // The API returns wars from a neutral perspective — our clan may be listed
                    // as either "clan" or "opponent". Swapping here means all downstream code
                    // can safely assume war.clan === our clan, war.opponent === the enemy.
                    if (ourWar.opponent.tag === ourClanFullTag) {
                        const tempClan = ourWar.clan;
                        ourWar.clan = ourWar.opponent;
                        ourWar.opponent = tempClan;
                    }
                    warDetails.push(ourWar);
                } else {
                    warDetails.push(null); // Our clan not found in this round's wars
                }
            }
        }
    } catch (err) {
        // 404: Clan is not currently in a CWL season (off-season or not signed up)
        // 403: API key issue — same handling
        if (err.statusCode === 404 || err.statusCode === 403) {
            cwlError = "Clan is not in an active CWL. Only the main roster has been loaded.";
        } else {
            cwlError = `An unexpected error occurred while fetching CWL data: ${err.message}`;
        }
    }

    // Return everything to the renderer. cwlMasterRoster and cwlError are always
    // included so the renderer can make decisions about data freshness.
    return { success: true, data: { clanInfo, warDetails, cwlError, cwlMasterRoster } };
});


// ── IPC HANDLER: export-data ──────────────────────────────────────────────────

/**
 * IPC HANDLER: 'export-data'
 * PURPOSE: Opens a native Save File dialog and writes the provided JSON string
 *          to the user-chosen path.
 *
 * REQUEST:  data (string) — pre-serialized JSON from state.js → exportData()
 * RESPONSE: { success: true, path: string }  — file written successfully
 *       OR: { success: false }                — user cancelled the dialog
 *       OR: { success: false, error: string } — write failed
 *
 * NOTE: __computed data is stripped by state.js before calling this handler.
 *
 * SEE ALSO: docs/architecture/data-flow.md → Flow 3: Save
 */
ipcMain.handle('export-data', (event, data) => {
  const window = BrowserWindow.getFocusedWindow();
  const options = {
    title: 'Export CWL Data as JSON',
    defaultPath: path.join(app.getPath('documents'), 'cwl-export.json'), // Sensible default location
    buttonLabel: 'Export',
    filters: [ { name: 'JSON Files', extensions: ['json'] } ]
  };
  return dialog.showSaveDialog(window, options).then(result => {
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, data);
      return { success: true, path: result.filePath };
    }
    return { success: false }; // User cancelled — not an error
  }).catch(err => {
    console.error('Export failed:', err);
    return { success: false, error: err.message };
  });
});

// ── IPC HANDLER: import-data ──────────────────────────────────────────────────

/**
 * IPC HANDLER: 'import-data'
 * PURPOSE: Opens a native Open File dialog and returns the content of the
 *          selected JSON file as a string. Parsing happens in the renderer.
 *
 * REQUEST:  (none)
 * RESPONSE: { success: true, data: string }  — file content as UTF-8 string
 *       OR: { success: false }                — user cancelled the dialog
 *       OR: { success: false, error: string } — read failed
 *
 * SEE ALSO: docs/architecture/data-flow.md → Flow 3: Load
 */
ipcMain.handle('import-data', () => {
  const window = BrowserWindow.getFocusedWindow();
  const options = {
    title: 'Import CWL Data',
    buttonLabel: 'Import',
    filters: [ { name: 'JSON Files', extensions: ['json'] } ],
    properties: ['openFile'] // Single file selection only
  };
  return dialog.showOpenDialog(window, options).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: data };
    }
    return { success: false }; // User cancelled — not an error
  }).catch(err => {
    console.error('Import failed:', err);
    return { success: false, error: err.message };
  });
});