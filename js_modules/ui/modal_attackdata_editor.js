// js_modules/ui/modal_attackdata_editor.js

import { getState, saveAppState, computeAll } from '../state.js';
import { round, openModal, closeModal } from './components.js';
import { calculatePerformanceScore } from '../calculator.js';

function createWarRowDisplay(player, war, dayIndex) {
    const { appSettings, cwlWarDetails } = getState();
    const row = document.createElement('div');
    row.className = 'modal-row';
    
    const warLabel = document.createElement('span');
    warLabel.textContent = `W${dayIndex + 1}`;
    
    const warDetail = cwlWarDetails && cwlWarDetails[dayIndex];
    const warState = warDetail ? warDetail.state : 'future'; // 'preparation', 'inWar', 'warEnded' or 'future'
    const isPrepDay = warState === 'preparation';
    const hasStarted = warState === 'inWar' || warState === 'warEnded';

    const myPos = document.createElement('span');
    const stars = document.createElement('span');
    const dest = document.createElement('span');
    const enemyTh = document.createElement('span');
    const enemyPos = document.createElement('span');
    const status = document.createElement('span');
    const scoreCell = document.createElement('span');

    if (!warDetail) {
        // Future/Unknown
        myPos.textContent = '-';
        stars.textContent = '-';
        dest.textContent = '-';
        enemyTh.textContent = '-';
        enemyPos.textContent = '-';
        status.textContent = '-';
        scoreCell.textContent = '-';
    } else {
        if (war.myPosition > 0) {
            // IN LINEUP
            myPos.textContent = isPrepDay ? '-' : war.myPosition;
            
            if (war.status === 'attacked') {
                stars.textContent = war.stars;
                dest.textContent = `${war.destruction}%`;
                enemyTh.textContent = war.opponentTh > 0 ? war.opponentTh : '-';
                enemyPos.textContent = war.opponentPosition > 0 ? war.opponentPosition : '-';
                status.textContent = 'Attacked';
                
                const score = calculatePerformanceScore(player, war);
                scoreCell.textContent = round(score, appSettings.decimals);
            } else if (war.status === 'missed') {
                stars.textContent = '0';
                dest.textContent = '0%';
                enemyTh.textContent = '-';
                enemyPos.textContent = '-';
                status.textContent = 'Missed';
                scoreCell.textContent = round(-20, appSettings.decimals); // Penalty
            } else {
                // Pending (In war but hasn't attacked yet)
                stars.textContent = '-';
                dest.textContent = '-';
                enemyTh.textContent = '-';
                enemyPos.textContent = '-';
                status.textContent = isPrepDay ? 'Prep' : 'Pending';
                scoreCell.textContent = '-'; // M-
            }

        } else {
            // BENCH (myPosition == 0)
            myPos.textContent = '-';
            stars.textContent = '-';
            dest.textContent = '-';
            enemyTh.textContent = '-';
            enemyPos.textContent = '-';
            
            if (hasStarted) {
                // If war started, Bench is a confirmed 0 score
                status.textContent = 'Benched';
                scoreCell.textContent = '0'; 
            } else {
                // Prep or Future
                status.textContent = '-';
                scoreCell.textContent = '-';
            }
        }
    }
    
    row.append(warLabel, myPos, stars, dest, enemyTh, enemyPos, status, scoreCell);
    return row;
}

export function openWarsEditor(originalPlayerIndex) {
    const { players } = getState();
    const player = players[originalPlayerIndex];
    if (!player) return;
    
    closeModal(document.querySelector('#attackEditorModal'));

    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.id = 'attackEditorModal';
    
    const handleClose = () => closeModal(modal);
    
    modal.onclick = (e) => { if (e.target === modal) handleClose(); };

    modal.innerHTML = `
      <div class="modal-card">
        <h3>${player.name} - Attack Data</h3>
        <div class="modal-grid">
          <div class="modal-header"><span>War</span><span>My Pos</span><span>Stars</span><span>Dest. %</span><span>Enemy TH</span><span>Enemy Pos</span><span>Status</span><span>Score</span></div>
        </div>
        <div class="modal-actions"><button id="modalCloseBtn" class="btn btn-primary">Close</button></div>
      </div>
    `;
    
    const warRowElements = player.wars.map((war, i) => createWarRowDisplay(player, war, i));
    
    modal.querySelector('.modal-grid').append(...warRowElements);
    modal.querySelector('#modalCloseBtn').onclick = handleClose;
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'modal-nav-btn modal-nav-prev';
    prevBtn.innerHTML = `<img src="img/direction.png" alt="Previous">`;
    if(originalPlayerIndex > 0) prevBtn.onclick = () => openWarsEditor(originalPlayerIndex - 1);
    else prevBtn.disabled = true;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'modal-nav-btn modal-nav-next';
    nextBtn.innerHTML = `<img src="img/direction.png" alt="Next">`;
    if (originalPlayerIndex < players.length - 1) nextBtn.onclick = () => openWarsEditor(originalPlayerIndex + 1);
    else nextBtn.disabled = true;

    modal.querySelector('.modal-card').append(prevBtn, nextBtn);
    openModal(modal);
}