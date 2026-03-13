// main.js

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const pkg = require('./package.json');

let apiToken;
try {
    const apiConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'api_config.json')));
    apiToken = apiConfig.apiToken;
} catch (error) {
    console.error("CRITICAL: Could not read api_config.json.");
    apiToken = null;
}

app.commandLine.appendSwitch('ignore-certificate-errors');

try {
  require('electron-reloader')(module);
} catch {}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    win.setTitle(`${pkg.productName} - v${pkg.version}`);
    win.setMenuBarVisibility(false);
    win.loadFile('index.html');
    // win.webContents.openDevTools(); // Optional: Keep open for debugging
}

app.whenReady().then(createWindow);
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('fetch-clan-data', async (event, clanTag) => {
    if (!apiToken) {
        return { success: false, error: "API Token is not configured." };
    }
    const sanitizedTag = clanTag.replace('#', '');
    const ourClanFullTag = `#${sanitizedTag}`;

    const apiRequest = (options) => {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try { resolve(JSON.parse(data)); } catch (e) { reject({ statusCode: 500, message: "Failed to parse API response." }); }
                    } else {
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

    let clanInfo;
    try {
        clanInfo = await apiRequest({
            hostname: 'api.clashofclans.com',
            path: `/v1/clans/%23${sanitizedTag}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });
    } catch (err) {
        let errorMessage = "An unknown error occurred.";
        if (err.statusCode === 403) errorMessage = "Access Denied. Check your API token and IP address.";
        else if (err.statusCode === 404) errorMessage = "Clan tag not found. Please check the tag and try again.";
        else errorMessage = `API Error ${err.statusCode || ''}: ${err.message}`;
        return { success: false, error: errorMessage };
    }

    let cwlGroupInfo = null;
    let warDetails = []; 
    let cwlError = null;
    let cwlMasterRoster = []; // NEW: List of all tags in the CWL season

    try {
        cwlGroupInfo = await apiRequest({
            hostname: 'api.clashofclans.com',
            path: `/v1/clans/%23${sanitizedTag}/currentwar/leaguegroup`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });

        // NEW: Extract the Master Roster for our clan
        if (cwlGroupInfo && cwlGroupInfo.clans) {
            const ourClanInGroup = cwlGroupInfo.clans.find(c => c.tag === ourClanFullTag);
            if (ourClanInGroup && ourClanInGroup.members) {
                cwlMasterRoster = ourClanInGroup.members.map(m => m.tag);
            }
        }

        if (cwlGroupInfo && cwlGroupInfo.rounds) {
            for (const round of cwlGroupInfo.rounds) {
                const validWarTags = round.warTags.filter(tag => tag && tag !== '#0');
                if (validWarTags.length === 0) {
                    warDetails.push(null); 
                    continue;
                }

                const roundWarDetailsPromises = validWarTags.map(warTag => apiRequest({
                    hostname: 'api.clashofclans.com',
                    path: `/v1/clanwarleagues/wars/%23${warTag.substring(1)}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiToken}` }
                }));
                
                const roundWarDetails = await Promise.all(roundWarDetailsPromises);
                
                const ourWar = roundWarDetails.find(war => war.clan.tag === ourClanFullTag || war.opponent.tag === ourClanFullTag);
                
                if (ourWar) {
                    if (ourWar.opponent.tag === ourClanFullTag) {
                        const tempClan = ourWar.clan;
                        ourWar.clan = ourWar.opponent;
                        ourWar.opponent = tempClan;
                    }
                    warDetails.push(ourWar);
                } else {
                    warDetails.push(null); 
                }
            }
        }
    } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 403) {
            cwlError = "Clan is not in an active CWL. Only the main roster has been loaded.";
        } else {
            cwlError = `An unexpected error occurred while fetching CWL data: ${err.message}`;
        }
    }
    
    // Pass cwlMasterRoster to frontend
    return { success: true, data: { clanInfo, warDetails, cwlError, cwlMasterRoster } };
});


ipcMain.handle('export-data', (event, data) => {
  const window = BrowserWindow.getFocusedWindow();
  const options = {
    title: 'Export CWL Data as JSON',
    defaultPath: path.join(app.getPath('documents'), 'cwl-export.json'),
    buttonLabel: 'Export',
    filters: [ { name: 'JSON Files', extensions: ['json'] } ]
  };
  return dialog.showSaveDialog(window, options).then(result => {
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, data);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  }).catch(err => {
    console.error('Export failed:', err);
    return { success: false, error: err.message };
  });
});

ipcMain.handle('import-data', () => {
  const window = BrowserWindow.getFocusedWindow();
  const options = {
    title: 'Import CWL Data',
    buttonLabel: 'Import',
    filters: [ { name: 'JSON Files', extensions: ['json'] } ],
    properties: ['openFile']
  };
  return dialog.showOpenDialog(window, options).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: data };
    }
    return { success: false };
  }).catch(err => {
    console.error('Import failed:', err);
    return { success: false, error: err.message };
  });
});