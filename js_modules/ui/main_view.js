// js_modules/ui/main_view.js

import { getState, saveAppState, deletePlayer, setActiveDayForNav } from '../state.js';
import { LEAGUES } from '../config.js';
import { round, createTd, showConfirmationModal } from './components.js';
import { createThSelector } from './th_selector.js';
import { openWarsEditor } from './modal_attackdata_editor.js';
import { openLineupEditor } from './modal_lineup_editor.js';
import { dom } from './dom.js';

// ... [renderDynamicControls, updateUIVisibility, createPlayerRowElement, renderPlayersTable unchanged] ...
function renderDynamicControls() {
    const { players, activeDayForNav, currentLiveDayIndex } = getState();
    const hasPlayers = players.length > 0;

    dom.warDaySelectorContainer.innerHTML = '';
    if (hasPlayers) {
        for (let i = 0; i < 7; i++) {
            const btn = document.createElement('button');
            btn.className = 'war-day-btn';
            
            if (i === currentLiveDayIndex) {
                btn.classList.add('active-live-war');
            }

            btn.dataset.dayIndex = i;
            btn.textContent = `War Day ${i + 1}`;
            btn.onclick = () => openLineupEditor(i);
            dom.warDaySelectorContainer.appendChild(btn);
        }
    }
}

export function updateUIVisibility() {
    const { players, clanMeta } = getState();
    const hasPlayers = players.length > 0;
    
    renderDynamicControls();

    dom.emptyStateContainer.classList.toggle('hidden', hasPlayers);
    dom.playerRosterContainer.classList.toggle('hidden', !hasPlayers);
    dom.rankingsSection.classList.toggle('hidden', !hasPlayers);
    dom.rosterControlsWrapper.classList.toggle('hidden', !hasPlayers);

    if (hasPlayers && clanMeta && dom.clanIdentityDisplay) {
        dom.clanIdentityDisplay.innerHTML = '';
        
        const badge = document.createElement('img');
        badge.src = clanMeta.badgeUrl;
        badge.className = 'clan-badge-img';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = clanMeta.name;
        nameSpan.className = 'clan-name-text';
        
        const leaguePill = document.createElement('span');
        leaguePill.className = 'league-pill';
        leaguePill.textContent = clanMeta.leagueName || 'Unranked';
        
        dom.clanIdentityDisplay.append(badge, nameSpan, leaguePill);
        dom.clanIdentityDisplay.classList.remove('hidden');
    } else if (dom.clanIdentityDisplay) {
        dom.clanIdentityDisplay.classList.add('hidden');
    }
}

function createPlayerRowElement(player, index) {
    const { appSettings, activeDayForNav } = getState();
    const tr = document.createElement('tr');
    tr.dataset.playerId = player.id;
    
    if (activeDayForNav !== -1) {
        if (player.wars[activeDayForNav] && player.wars[activeDayForNav].myPosition > 0) {
            tr.className = 'row-active';
        } else {
            tr.className = 'row-bench';
        }
    }
    
    const tdSerial = createTd();
    tdSerial.textContent = index + 1;
    tr.appendChild(tdSerial);
    
    const tdName = createTd();
    tdName.textContent = player.name;
    tr.appendChild(tdName);
    
    const tdTh = createTd();
    const thWrapper = document.createElement('div');
    thWrapper.style.display = 'flex';
    thWrapper.style.alignItems = 'center';
    thWrapper.style.justifyContent = 'center';
    thWrapper.style.gap = '8px';

    const thIcon = document.createElement('img');
    thIcon.src = `img/th${player.th}.png`;
    thIcon.alt = `TH ${player.th}`;
    thIcon.style.height = '32px';
    thIcon.style.width = 'auto';

    const thText = document.createElement('span');
    thText.textContent = player.th;
    thText.style.fontWeight = 'bold';

    thWrapper.append(thText, thIcon);
    tdTh.appendChild(thWrapper);
    tr.appendChild(tdTh);
    
    const tdWars = createTd();
    const warsBtn = document.createElement('button');
    warsBtn.className = 'btn btn-icon-edit btn-icon-stats'; 
    warsBtn.setAttribute('aria-label', `View attack data for ${player.name}`);
    warsBtn.onclick = () => {
        const players = getState().players;
        const playerToEdit = players.find(p => p.id === player.id);
        const currentIndex = players.indexOf(playerToEdit);
        if (currentIndex > -1) {
            openWarsEditor(currentIndex);
        }
    };
    const editIcon = document.createElement('img');
    editIcon.src = 'img/stats.png'; 
    editIcon.alt = 'Stats';
    warsBtn.appendChild(editIcon);
    tdWars.appendChild(warsBtn);
    tr.appendChild(tdWars);
    
    tr.appendChild(createTd()).textContent = round(player.__computed?.totalPerfScore, appSettings.decimals);
    tr.appendChild(createTd()).textContent = round(player.__computed?.participations, 0);
    tr.appendChild(createTd()).textContent = round(player.__computed?.avgPerformance, appSettings.decimals);
    tr.appendChild(createTd()).textContent = round(player.__computed?.totalStars, 0);
    
    tr.appendChild(createTd()).textContent = player.__computed?.currentRank ?? '-';
    
    return tr;
}

export function renderPlayersTable() {
    const { players, appSettings, activeDayForNav, warFormat } = getState();
    dom.playersBody.innerHTML = '';
    
    const playersToRender = players.filter(p => {
        if (appSettings.hideNonCwl && !p.isCwlMember) return false;
        
        if (appSettings.hideBench) {
            if (activeDayForNav !== -1) {
                if (p.isCwlMember && p.wars[activeDayForNav].myPosition === 0) return false;
            } else {
                if ((p.__computed?.participations || 0) === 0) return false;
            }
        }
        return true;
    });

    playersToRender.forEach((p, index) => {
        const row = createPlayerRowElement(p, index);
        if (activeDayForNav !== -1 && !appSettings.hideBench && !appSettings.hideNonCwl) {
            if (index === warFormat - 1) {
                row.classList.add('row-separator');
            }
        }
        dom.playersBody.appendChild(row);
    });
}

export function renderRankingsTable() {
    const { players, cwlFinished, warsWon, bonusCount, clanMeta, appSettings } = getState(); // Added bonusCount/clanMeta
    dom.rankingsBody.innerHTML = '';
    
    // --- SEASON SUMMARY CARD LOGIC ---
    // Clear old manual controls area to inject summary if finished
    const controlsContainer = document.querySelector('.cwl-status-controls');
    
    if (cwlFinished) {
        // Hide manual controls
        controlsContainer.style.display = 'none';
        
        // Check if summary card already exists
        let summaryCard = document.getElementById('seasonSummaryCard');
        if (!summaryCard) {
            summaryCard = document.createElement('div');
            summaryCard.id = 'seasonSummaryCard';
            summaryCard.className = 'season-summary-card';
            
            // Insert after the hidden controls
            controlsContainer.parentNode.insertBefore(summaryCard, controlsContainer.nextSibling);
        }
        
        // Populate Summary
        const leagueName = clanMeta?.leagueName || "Unknown League";
        summaryCard.innerHTML = `
            <div class="season-summary-title">Season Complete: ${leagueName}</div>
            <div class="season-summary-stats">${warsWon} Wins • ${7 - warsWon} Losses</div>
            <div class="season-summary-bonus">${bonusCount} Bonuses Available</div>
        `;
        
        // Show Bonus Header
        dom.bonusHeaderTh.classList.remove('hidden');
        dom.bonusCountDisplay.textContent = ''; // Handled by card now
    } else {
        // Not finished? Show manual controls (Fallback)
        controlsContainer.style.display = 'flex';
        const summaryCard = document.getElementById('seasonSummaryCard');
        if(summaryCard) summaryCard.remove();
        
        dom.bonusHeaderTh.classList.add('hidden');
    }
    // ---------------------------------

    players.forEach(p => { if(p.__computed) p.__computed.finalPosition = undefined; }); 
    const participatingPlayers = players.filter(p => p.__computed.participations > 0);
    const sortedByScore = [...participatingPlayers].sort((a, b) => (b.__computed.avgPerformance || 0) - (a.__computed.avgPerformance || 0));
    let currentPosition = 0, lastScore = -Infinity;
    sortedByScore.forEach((p, idx) => {
        if (p.__computed.avgPerformance.toFixed(5) !== lastScore) { currentPosition = idx + 1; }
        p.__computed.finalPosition = currentPosition;
        lastScore = p.__computed.avgPerformance.toFixed(5);
    });
    const rankedPlayers = sortedByScore.sort((a,b) => (a.__computed.finalPosition || Infinity) - (b.__computed.finalPosition || Infinity));
    
    let bonusesCurrentlyChecked = players.filter(pl => pl.isBonusGiven).length;

    rankedPlayers.forEach(p => {
        const tr = document.createElement('tr');
        const tdRank = createTd();
        const rankContainer = document.createElement('div');
        rankContainer.className = 'rank-cell-content';
        const rankSpan = document.createElement('span');
        rankSpan.textContent = p.__computed?.finalPosition ?? '-';
        rankContainer.appendChild(rankSpan);
        tdRank.appendChild(rankContainer);
        if (p.__computed?.finalPosition === 1) { rankSpan.classList.add('rank-gold'); const icon=document.createElement('img'); icon.src='img/gold-trophy.png'; icon.className='rank-icon'; rankContainer.appendChild(icon); }
        else if (p.__computed?.finalPosition === 2) { rankSpan.classList.add('rank-silver'); const icon=document.createElement('img'); icon.src='img/silver-trophy.png'; icon.className='rank-icon'; rankContainer.appendChild(icon); }
        else if (p.__computed?.finalPosition === 3) { rankSpan.classList.add('rank-bronze'); const icon=document.createElement('img'); icon.src='img/bronze-trophy.png'; icon.className='rank-icon'; rankContainer.appendChild(icon); }
        tr.appendChild(tdRank);
        tr.appendChild(createTd()).textContent = p.name;
        
        tr.appendChild(createTd()).textContent = round(p.__computed?.participations, 0);
        
        tr.appendChild(createTd()).textContent = round(p.__computed?.avgPerformance, appSettings.decimals);
        tr.appendChild(createTd()).textContent = round(p.__computed?.totalStars, 0);
        const tdBonus = createTd();
        
        // Show Checkbox if CWL Finished
        if (cwlFinished) {
            tdBonus.classList.remove('hidden');
            const bonusCheckbox = document.createElement('input');
            bonusCheckbox.type = 'checkbox';
            const originalPlayer = players.find(pl => pl.id === p.id);
            bonusCheckbox.checked = originalPlayer.isBonusGiven;
            // Limit checkboxes based on calculated bonusCount
            bonusCheckbox.disabled = !originalPlayer.isBonusGiven && bonusesCurrentlyChecked >= bonusCount;
            bonusCheckbox.onchange = (e) => {
                if (originalPlayer) { originalPlayer.isBonusGiven = e.target.checked; }
                saveAppState(); 
                renderRankingsTable(); 
            };
            tdBonus.appendChild(bonusCheckbox);
        } else {
            tdBonus.classList.add('hidden');
        }
        
        tr.appendChild(tdBonus);
        dom.rankingsBody.appendChild(tr);
    });
}