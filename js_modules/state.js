// js_modules/state.js

import { config, LEAGUES } from './config.js';
import { calculatePerformanceScore } from './calculator.js';
import { updateUIVisibility, renderPlayersTable, renderRankingsTable } from './ui/main_view.js';
import { showToast } from './ui/components.js';
import { applySettingsUI, updateFetchButtonState } from './events.js';
import { dom } from './ui/dom.js';

let players = [];
let cwlWarDetails = []; 
let cwlFinished = false; // Auto-calculated now
let warsWon = 0;         // Auto-calculated now
let bonusCount = 0;      // Auto-calculated now
let cwlLeague = LEAGUES[6].id;
let appSettings = { decimals: 3, bestAttacksToAverage: 6, autoRefreshInterval: 0, hideNonCwl: false, hideBench: false };
let activeDayForNav = -1;
let currentLiveDayIndex = -1;
let savedClanTag = '';
let clanMeta = null; 

// ... [sortPlayersForActiveDay, getState, getSavedClanTag, saveAppState unchanged] ...
function sortPlayersForActiveDay() {
    if (activeDayForNav === -1) {
        players.sort((a, b) => (a.clanRank || 0) - (b.clanRank || 0));
        return;
    }
    const lineup = [];
    const substitutes = [];
    players.forEach(player => {
        const warData = player.wars[activeDayForNav];
        if (warData && warData.myPosition > 0) {
            lineup.push({ player, position: warData.myPosition });
        } else {
            substitutes.push(player);
        }
    });
    lineup.sort((a, b) => a.position - b.position);
    players = [...lineup.map(item => item.player), ...substitutes];
}

export function getState() {
    return { players, cwlWarDetails, cwlFinished, warsWon, bonusCount, cwlLeague, warFormat: config.warFormat, appSettings, activeDayForNav, currentLiveDayIndex, clanMeta };
}

export function getSavedClanTag() {
    return savedClanTag;
}

export function saveAppState() {
    localStorage.setItem(config.localStorageKey, JSON.stringify(players));
    localStorage.setItem('cwl_war_details', JSON.stringify(cwlWarDetails));
    localStorage.setItem(config.settingsStorageKey, JSON.stringify(appSettings));
    // Derived values (warsWon, etc) are recalculated, but good to store for persistence if needed
    localStorage.setItem(config.cwlLeagueKey, cwlLeague);
    localStorage.setItem(config.warFormatKey, config.warFormat.toString());
    localStorage.setItem('cwl_live_day_index', currentLiveDayIndex.toString());
    
    if (clanMeta) {
        localStorage.setItem('cwl_clan_meta', JSON.stringify(clanMeta));
    }

    if (dom.clanTagInput && dom.clanTagInput.value) {
        localStorage.setItem('cwl_clan_tag', dom.clanTagInput.value);
        savedClanTag = dom.clanTagInput.value;
    }
}

export function computeAll() {
    updateUIVisibility();
    sortPlayersForActiveDay();
    
    // 1. AUTOMATE WARS WON & SEASON STATUS
    let warsStarted = 0;
    let wins = 0;
    
    if (cwlWarDetails && cwlWarDetails.length > 0) {
        cwlWarDetails.forEach(war => {
            if (war && (war.state === 'inWar' || war.state === 'warEnded')) {
                warsStarted++;
                // Win Calculation: Stars > Enemy OR (Stars Equal AND Dest > Enemy)
                if (war.state === 'warEnded') {
                    if (war.clan.stars > war.opponent.stars) {
                        wins++;
                    } else if (war.clan.stars === war.opponent.stars) {
                        if (war.clan.destructionPercentage > war.opponent.destructionPercentage) {
                            wins++;
                        }
                    }
                }
            }
        });
    }
    
    warsWon = wins;
    // If all 7 wars have at least started (or ended), we consider CWL "Finished" for calculation purposes
    // Or strictly if 7 wars are 'warEnded'. Let's use 7 wars present in data to show the summary.
    cwlFinished = (warsStarted === 7); 

    // 2. AUTOMATE BONUS CALCULATION
    // Find league base
    let leagueBase = 0;
    if (clanMeta && clanMeta.leagueName) {
        // Try to match API league name to our config
        // Only if we have mapped it. Fallback to manually saved cwlLeague if API string doesn't match perfectly
        const foundLeague = LEAGUES.find(l => l.name === clanMeta.leagueName);
        if (foundLeague) {
            cwlLeague = foundLeague.id; // Sync internal ID
            leagueBase = foundLeague.base;
        } else {
            // Fallback to whatever was stored
            const stored = LEAGUES.find(l => l.id === cwlLeague);
            if(stored) leagueBase = stored.base;
        }
    } else {
        const stored = LEAGUES.find(l => l.id === cwlLeague);
        if(stored) leagueBase = stored.base;
    }
    
    bonusCount = leagueBase + warsWon;

    // 3. PLAYER SCORES (Existing Logic)
    players.forEach(p => {
        p.__computed = p.__computed || {};
        p.__computed.warScores = [];
        let participations = 0;
        let totalStars = 0;
        let scorableEventsCount = 0;

        for (let i = 0; i < 7; i++) {
            if (i >= warsStarted) continue;
            const war = p.wars[i];
            
            if (war.myPosition > 0) {
                if (war.status === 'attacked' || war.status === 'missed') {
                    participations++;
                    scorableEventsCount++;
                    const score = calculatePerformanceScore(p, war);
                    p.__computed.warScores.push(score !== null ? score : 0);
                    if (war.status === 'attacked') totalStars += (war.stars || 0);
                } else {
                    // Pending - ignored
                }
            } else {
                scorableEventsCount++;
                p.__computed.warScores.push(0);
            }
        }

        p.__computed.participations = participations;
        p.__computed.totalStars = totalStars;

        const validScores = p.__computed.warScores.filter(s => typeof s === 'number' && !isNaN(s));
        p.__computed.totalPerfScore = validScores.reduce((acc, score) => acc + score, 0);
        
        const sortedScores = [...validScores].sort((a, b) => b - a);
        const scoresToAverage = sortedScores.slice(0, appSettings.bestAttacksToAverage);
        
        if (scorableEventsCount > 0) {
            const sum = scoresToAverage.reduce((acc, score) => acc + score, 0);
            const divisor = Math.min(scorableEventsCount, appSettings.bestAttacksToAverage);
            p.__computed.avgPerformance = sum / divisor;
        } else {
            p.__computed.avgPerformance = 0;
        }
    });

    const sortedForRank = [...players].sort((a, b) => (b.__computed.avgPerformance || 0) - (a.__computed.avgPerformance || 0));
    let currentRank = 0;
    let lastScore = -Infinity;
    
    sortedForRank.forEach((p, idx) => {
        const score = p.__computed.avgPerformance || 0;
        if (score !== lastScore) {
            currentRank = idx + 1;
        }
        p.__computed.currentRank = currentRank;
        lastScore = score;
    });

    renderPlayersTable();
    renderRankingsTable();
}

// ... [loadInitialData, loadSettings unchanged] ...
export function loadInitialData() {
    try {
        const storedPlayers = JSON.parse(localStorage.getItem(config.localStorageKey) || '[]');
        const storedWarDetails = JSON.parse(localStorage.getItem('cwl_war_details') || '[]');
        cwlWarDetails = storedWarDetails;

        const storedMeta = localStorage.getItem('cwl_clan_meta');
        if (storedMeta) {
            clanMeta = JSON.parse(storedMeta);
        }

        if (Array.isArray(storedPlayers) && storedPlayers.length > 0) {
            players = storedPlayers;
            players.forEach(p => {
                p.id = p.id || `player_${Date.now()}_${Math.random()}`;
                p.th = p.th || 18;
                if (!p.__computed) p.__computed = {};
            });
        } else { players = []; }
        cwlFinished = localStorage.getItem(config.cwlFinishedKey) === 'true';
        warsWon = Number(localStorage.getItem(config.warsWonKey)) || 0;
        cwlLeague = localStorage.getItem(config.cwlLeagueKey) || LEAGUES[6].id;
        config.warFormat = Number(localStorage.getItem(config.warFormatKey)) || 15;
        activeDayForNav = Number(localStorage.getItem(config.activeDayForNavKey)) || -1;
        currentLiveDayIndex = Number(localStorage.getItem('cwl_live_day_index')) || -1;
        
        savedClanTag = localStorage.getItem('cwl_clan_tag') || '';
        if (savedClanTag && dom.clanTagInput) {
            dom.clanTagInput.value = savedClanTag;
        }
        
        if (activeDayForNav !== -1) {
            sortPlayersForActiveDay();
        }
    } catch(e) { 
        console.error('Local storage load failed. Resetting state:', e); 
        localStorage.clear(); 
        players = []; 
        cwlWarDetails = [];
        clanMeta = null;
    }
    loadSettings();
}

export function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem(config.settingsStorageKey));
    if (savedSettings) { appSettings = { ...appSettings, ...savedSettings }; }
    applySettingsUI();
    computeAll();
}

export function updateSetting(key, value) {
    appSettings[key] = value;
    saveAppState();
    applySettingsUI();
    computeAll();
}

// ... [setWarFormat, setActiveDayForNav, addPlayer, deletePlayer, resetAllData unchanged] ...
export function setWarFormat(newFormat) {
    config.warFormat = newFormat;
    saveAppState();
    computeAll();
}

export function setActiveDayForNav(dayIndex) {
    activeDayForNav = dayIndex;
    sortPlayersForActiveDay();
    saveAppState();
    computeAll();
}

export function addPlayer() {
    const defaultWars = Array.from({length: config.numWars}).map(()=>({ myPosition: 0, opponentPosition: 0, opponentTh: 18, status:'', stars:0, destruction:0 }));
    const newPlayer = { id: `player_${Date.now()}_${Math.random()}`, name:'New Player', th: 18, wars: defaultWars, isBonusGiven: false, __computed:{} };
    players.push(newPlayer);
    computeAll(); 
    return newPlayer.id;
}

export function deletePlayer(originalPlayerIndex) {
    players.splice(originalPlayerIndex, 1);
    saveAppState();
    computeAll();
}

export function resetAllData() {
    players = [];
    cwlWarDetails = [];
    activeDayForNav = -1;
    currentLiveDayIndex = -1;
    cwlFinished = false;
    warsWon = 0;
    cwlLeague = LEAGUES[6].id;
    config.warFormat = 15;
    savedClanTag = ''; 
    clanMeta = null; 
    localStorage.clear();
    dom.clanTagInput.value = '';
    dom.format15v15Radio.checked = true;
    dom.cwlFinishedCheckbox.checked = false;
    dom.warsWonSelect.value = 0;
    dom.leagueSelect.value = cwlLeague;
    
    if (dom.warDaySelectorContainer) dom.warDaySelectorContainer.innerHTML = '';
    
    updateFetchButtonState(); 
    
    loadSettings();
    showToast('All data has been successfully reset.');
}

export function setCwlFinished(isFinished) { cwlFinished = isFinished; saveAppState(); computeAll(); }
export function setWarsWon(count) { warsWon = count; saveAppState(); computeAll(); }
export function setCwlLeague(leagueId) { cwlLeague = leagueId; saveAppState(); computeAll(); }

export async function exportData() {
    const sanitizedPlayers = players.map(p => { const { __computed, ...rest } = p; return rest; });
    const state = { players: sanitizedPlayers, cwlWarDetails, cwlFinished, warsWon, cwlLeague, warFormat: config.warFormat, appSettings, activeDayForNav, currentLiveDayIndex, clanMeta };
    const result = await window.api.exportData(JSON.stringify(state, null, 2));
    if (result.success) { showToast('Data saved successfully!'); }
}

export async function importData() {
    const result = await window.api.importData();
    if (result.success) {
        try {
            const importedData = JSON.parse(result.data);
            players = importedData.players || [];
            cwlWarDetails = importedData.cwlWarDetails || [];
            cwlFinished = importedData.cwlFinished || false;
            warsWon = importedData.warsWon || 0;
            cwlLeague = importedData.cwlLeague || LEAGUES[6].id;
            config.warFormat = importedData.warFormat || 15;
            activeDayForNav = importedData.activeDayForNav ?? -1;
            currentLiveDayIndex = importedData.currentLiveDayIndex ?? -1;
            clanMeta = importedData.clanMeta || null; 
            
            if(importedData.appSettings) appSettings = { ...appSettings, ...importedData.appSettings };
            
            players.forEach(p => {
                p.id = p.id || `player_${Date.now()}_${Math.random()}`;
                p.th = p.th || 18;
                p.isBonusGiven = p.isBonusGiven || false;
                if (!p.wars || p.wars.length < config.numWars) {
                    const existingWars = p.wars || [];
                    const needed = config.numWars - existingWars.length;
                    const newWars = Array.from({length: needed}).map(()=>({myPosition: 0, opponentPosition: 0, opponentTh: 18, status:'', stars:0, destruction:0}));
                    p.wars = existingWars.concat(newWars);
                }
                p.__computed = {};
            });
            
            dom.cwlFinishedCheckbox.checked = cwlFinished;
            dom.warsWonSelect.value = warsWon;
            dom.leagueSelect.value = cwlLeague;
            document.getElementById(`format${config.warFormat}v${config.warFormat}`).checked = true;
            saveAppState();
            loadSettings();
            showToast('Data loaded successfully!');
        } catch (err) { console.error("Error parsing imported file:", err); showToast('Import failed: The file is invalid.', 'error'); }
    }
}

export function handleSaveLineup(dayIndex, lineup) {
    const lineupIds = new Set(lineup.map(p => p.id));
    
    lineup.forEach((player, index) => {
        const playerInData = players.find(p => p.id === player.id);
        if (playerInData) {
            playerInData.wars[dayIndex].myPosition = index + 1;
            if (playerInData.wars[dayIndex].opponentPosition === 0) {
                playerInData.wars[dayIndex].opponentPosition = index + 1;
            }
        }
    });

    players.forEach(player => {
        if (!lineupIds.has(player.id)) {
            player.wars[dayIndex].myPosition = 0;
        }
    });

    saveAppState();
    computeAll();
}

export function processApiData(apiData) {
    const { clanInfo, warDetails, cwlError, cwlMasterRoster } = apiData;

    // --- DATA FREEZE SAFEGUARD ---
    // If API returns error/null, but we already have data, ABORT to protect local data
    if (cwlError && cwlWarDetails.length > 0) {
        showToast("Season data not available from API. Loaded cached data.", "info", true);
        return; // STOP HERE
    }
    // If warDetails is empty but we expected data
    if ((!warDetails || warDetails.length === 0) && cwlWarDetails.length > 0) {
        showToast("API returned empty season. Keeping cached data.", "info", true);
        return; // STOP HERE
    }
    // -----------------------------

    cwlWarDetails = warDetails || [];
    currentLiveDayIndex = -1;

    if (clanInfo) {
        clanMeta = {
            name: clanInfo.name,
            badgeUrl: clanInfo.badgeUrls?.medium,
            leagueName: clanInfo.warLeague?.name
        };
    }

    const newPlayers = [];
    const playerMap = new Map();
    const rosterSet = new Set(cwlMasterRoster || []);

    (clanInfo.memberList || []).forEach(member => {
        const defaultWars = Array.from({ length: config.numWars }, () => ({
            myPosition: 0, opponentPosition: 0, opponentTh: 0,
            status: '', stars: 0, destruction: 0
        }));
        
        const newPlayer = {
            id: member.tag, 
            name: member.name, 
            th: member.townHallLevel,
            clanRank: member.clanRank,
            isCwlMember: rosterSet.has(member.tag),
            wars: defaultWars, 
            isBonusGiven: false, 
            __computed: {}
        };
        newPlayers.push(newPlayer);
        playerMap.set(member.tag, newPlayer);
    });

    if (!cwlError && warDetails && warDetails.length > 0) {
        warDetails.forEach((war, dayIndex) => {
            if (!war || !war.clan || !war.opponent) return;

            if (war.state === 'inWar') {
                currentLiveDayIndex = dayIndex;
            }

            const enemyThMap = new Map();
            (war.opponent.members || []).forEach(m => enemyThMap.set(m.tag, m.townHallLevel));
            
            const ourActiveMembers = (war.clan.members || []).sort((a, b) => a.mapPosition - b.mapPosition);
            const ourRankMap = new Map();
            ourActiveMembers.forEach((m, i) => ourRankMap.set(m.tag, i + 1));

            const enemyActiveMembers = (war.opponent.members || []).sort((a, b) => a.mapPosition - b.mapPosition);
            const enemyRankMap = new Map();
            enemyActiveMembers.forEach((m, i) => enemyRankMap.set(m.tag, i + 1));

            (war.clan.members || []).forEach((member) => {
                const player = playerMap.get(member.tag);
                if (player) {
                    player.wars[dayIndex].myPosition = ourRankMap.get(member.tag) || 0;
                    
                    if (player.wars[dayIndex].myPosition > 0) {
                        if (war.state === 'warEnded') {
                            player.wars[dayIndex].status = 'missed';
                        } else {
                             player.wars[dayIndex].status = ''; 
                        }
                    }

                    if (member.attacks && Array.isArray(member.attacks)) {
                        member.attacks.forEach(attack => {
                            const warDayData = player.wars[dayIndex];
                            warDayData.status = 'attacked';
                            warDayData.stars = attack.stars;
                            warDayData.destruction = attack.destructionPercentage;
                            
                            const opponentMember = war.opponent.members.find(m => m.tag === attack.defenderTag);
                            if (opponentMember) {
                                warDayData.opponentTh = opponentMember.townhallLevel;
                                warDayData.opponentPosition = enemyRankMap.get(attack.defenderTag) || 0;
                            } else {
                                warDayData.opponentTh = enemyThMap.get(attack.defenderTag) || 0;
                            }
                        });
                    }
                }
            });
        });

        if (warDetails[0] && warDetails[0].teamSize) {
            config.warFormat = warDetails[0].teamSize;
            document.getElementById(`format${config.warFormat}v${config.warFormat}`).checked = true;
        }
    } else if (cwlError) {
        showToast(cwlError, 'error');
    }

    players = newPlayers;
    
    if (currentLiveDayIndex !== -1) {
        activeDayForNav = currentLiveDayIndex;
    } else {
        activeDayForNav = -1;
    }

    saveAppState();
    computeAll();
}