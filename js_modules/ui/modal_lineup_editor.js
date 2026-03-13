// js_modules/ui/modal_lineup_editor.js

import { getState } from '../state.js';
import { openModal, closeModal } from './components.js';

function getLineupForDay(dayIndex, clanType, warFormat) {
    const { players, cwlWarDetails } = getState();
    
    // 1. Try to use rich API data if available
    const war = cwlWarDetails && cwlWarDetails[dayIndex];
    
    // Check if we have valid war data for this specific day
    if (war && war.clan && war.opponent) {
        if (clanType === 'clan') {
            return war.clan.members.map(m => ({
                id: m.tag, // Pass tag for lookup
                name: m.name,
                th: m.townhallLevel,
                position: m.mapPosition
            })).sort((a, b) => a.position - b.position);
        } else {
            // Directly use the opponent roster from the API
            // Check if we're in preparation
            if (war.state === 'preparation') return 'PREPARATION';

            return war.opponent.members.map(m => ({
                name: m.name,
                th: m.townhallLevel,
                position: m.mapPosition
            })).sort((a, b) => a.position - b.position);
        }
    }

    // 2. Fallback to Manual Data (Only if API data is missing)
    const lineup = [];
    if (clanType === 'clan') {
        players.forEach(player => {
            const warData = player.wars[dayIndex];
            if (warData && warData.myPosition > 0) {
                lineup.push({
                    id: player.id,
                    name: player.name,
                    th: player.th,
                    position: warData.myPosition
                });
            }
        });
        return lineup.sort((a, b) => a.position - b.position);
    }
    return [];
}

export function openLineupEditor(dayIndex) {
    const { warFormat, cwlWarDetails, players } = getState();
    closeModal(document.getElementById('lineupEditorModal'));
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.id = 'lineupEditorModal';

    const handleClose = () => closeModal(modal);

    const ourLineup = getLineupForDay(dayIndex, 'clan', warFormat);
    const enemyLineup = getLineupForDay(dayIndex, 'opponent', warFormat);
    
    if (!ourLineup || ourLineup.length === 0) {
        modal.innerHTML = `<div class="modal-card"><h3>War Day ${dayIndex + 1}</h3><p class="confirm-message">Roster data for this day is not available.</p><div class="modal-actions"><div class="modal-actions-right"><button id="closeBtn" class="btn btn-primary">Close</button></div></div></div>`;
        openModal(modal);
        modal.querySelector('#closeBtn').onclick = handleClose;
        return;
    }

    modal.innerHTML = `
        <div class="modal-card">
            <h3>War Day ${dayIndex + 1} – ${warFormat}v${warFormat}</h3>
            <div class="lineup-editor-content">
                <div class="lineup-column">
                    <div class="lineup-column-header">Your Clan Lineup</div>
                    <div class="lineup-list-grid">
                        <div class="lineup-numbers-column" id="yourNumbersColumn"></div>
                        <div class="lineup-players-column" id="yourPlayersColumn"></div>
                    </div>
                </div>
                <div class="lineup-column">
                    <div class="lineup-column-header">Enemy Clan Lineup</div>
                    <div class="lineup-list-grid" id="enemyLineupContainer">
                        <!-- Content injected below based on state -->
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <div class="modal-actions-right">
                    <button id="closeBtn" class="btn btn-primary">Close</button>
                </div>
            </div>
        </div>
    `;
    
    const yourNumbersCol = modal.querySelector('#yourNumbersColumn');
    const yourPlayersCol = modal.querySelector('#yourPlayersColumn');
    const enemyContainer = modal.querySelector('#enemyLineupContainer');

    const getThIcon = (th) => {
        if (th > 0) {
            return `<img src="img/th${th}.png" alt="TH ${th}" class="th-selector-icon">`;
        }
        return ''; 
    };

    ourLineup.forEach((member, index) => {
        const numberDiv = document.createElement('div');
        numberDiv.className = 'lineup-position';
        numberDiv.textContent = `${index + 1}.`;
        yourNumbersCol.appendChild(numberDiv);

        const playerButton = document.createElement('div');
        playerButton.className = 'player-item-button';
        
        // ### NEW: Traffic Light Logic ###
        let statusHtml = '';
        const playerObj = players.find(p => p.id === member.id);
        if (playerObj) {
            const warData = playerObj.wars[dayIndex];
            
            if (warData.status === 'attacked') {
                statusHtml = '<span class="status-circle status-green"></span>';
            } else if (warData.status === 'missed') {
                statusHtml = '<span class="status-circle status-red"></span>';
            } else {
                // Pending/Active but not attacked
                statusHtml = '<span class="status-circle status-white"></span>';
            }
        }

        playerButton.innerHTML = `<span class="lineup-player-name">${member.name} ${statusHtml}</span>${getThIcon(member.th)}`;
        yourPlayersCol.appendChild(playerButton);
    });

    if (enemyLineup === 'PREPARATION') {
        enemyContainer.style.display = 'flex';
        enemyContainer.style.alignItems = 'center';
        enemyContainer.style.justifyContent = 'center';
        enemyContainer.innerHTML = `<p style="text-align: center; color: var(--color-ink-light); font-style: italic;">Enemy lineup is hidden during Preparation Day.</p>`;
    } else {
        const enemyNumbersCol = document.createElement('div');
        enemyNumbersCol.className = 'lineup-numbers-column';
        const enemyPlayersCol = document.createElement('div');
        enemyPlayersCol.className = 'lineup-players-column';
        
        enemyContainer.appendChild(enemyNumbersCol);
        enemyContainer.appendChild(enemyPlayersCol);

        enemyLineup.forEach((player, index) => {
            const numberDiv = document.createElement('div');
            numberDiv.className = 'lineup-position';
            numberDiv.textContent = `${index + 1}.`;
            enemyNumbersCol.appendChild(numberDiv);

            const playerButton = document.createElement('div');
            playerButton.className = 'player-item-button';
            playerButton.innerHTML = `<span class="lineup-player-name">${player.name}</span>${getThIcon(player.th)}`;
            enemyPlayersCol.appendChild(playerButton);
        });
    }

    modal.querySelector('#closeBtn').onclick = handleClose;
    openModal(modal);
}