/**
 * FILE: modal_attackdata_editor.js
 * PROCESS: Renderer
 * ROLE: Per-player attack data viewer modal. Displays a read-only grid of all
 *       7 war days for a given player, showing their lineup position, attack
 *       results, and computed performance score for each day. Supports prev/next
 *       navigation to cycle through players without closing the modal.
 *
 * DEPENDENCIES:
 *   - state.js:      getState(), saveAppState(), computeAll()
 *   - ui/components.js: round(), openModal(), closeModal()
 *   - calculator.js: calculatePerformanceScore() — recalculates score for display
 *
 * EXPORTS:
 *   - openWarsEditor(originalPlayerIndex): Open the attack data modal for a player
 *
 * DOCS:
 *   - docs/architecture/data-flow.md → Flow 2: Scoring a Single Attack
 */

import { getState, saveAppState, computeAll } from '../state.js';
import { round, openModal, closeModal } from './components.js';
import { calculatePerformanceScore } from '../calculator.js';

/**
 * FUNCTION: createWarRowDisplay
 * PURPOSE: Builds a single display row for one war day in the attack data modal.
 *          This is a state machine: its output depends on the war's overall state
 *          (future/preparation/inWar/warEnded) AND the player's specific status
 *          for that day (not in lineup / pending / attacked / missed).
 *
 * @param player   - Full player object (needs player.th for score calculation)
 * @param war      - Player's war data for this day: player.wars[dayIndex]
 * @param dayIndex - 0-6: which war day this row represents
 * @returns HTMLDivElement — a .modal-row element with all columns populated
 *
 * STATE MACHINE (war state × player status):
 *
 *   warDetail missing (future/unknown):
 *     → All columns show '-'
 *
 *   warDetail exists AND war.myPosition > 0 (player in lineup):
 *     → status === 'attacked':
 *         My Pos = position (hidden during prep), Stars, Dest%, EnemyTH, EnemyPos, Score all shown
 *     → status === 'missed':
 *         Stars = 0, Dest = 0%, Score = -20 (penalty)
 *     → status === '' (pending in prep):
 *         Status = 'Prep', everything else '-'
 *     → status === '' (pending in live war):
 *         Status = 'Pending', everything else '-'
 *
 *   warDetail exists AND war.myPosition === 0 (benched):
 *     → war has started (inWar/warEnded): Status = 'Benched', Score = 0
 *     → war in prep or future: Status = '-', Score = '-'
 *
 * CALLED BY: modal_attackdata_editor.js → openWarsEditor()
 */
function createWarRowDisplay(player, war, dayIndex) {
    const { appSettings, cwlWarDetails } = getState();
    const row = document.createElement('div');
    row.className = 'modal-row';

    // War day label (W1 through W7)
    const warLabel = document.createElement('span');
    warLabel.textContent = `W${dayIndex + 1}`;

    // Determine the overall state of this war day from the API data
    const warDetail = cwlWarDetails && cwlWarDetails[dayIndex];
    const warState = warDetail ? warDetail.state : 'future'; // 'preparation' | 'inWar' | 'warEnded' | 'future'
    const isPrepDay = warState === 'preparation'; // Enemy lineup is hidden during prep
    const hasStarted = warState === 'inWar' || warState === 'warEnded'; // War is/was active

    // Create all column span elements (populated below based on state)
    const myPos = document.createElement('span');
    const stars = document.createElement('span');
    const dest = document.createElement('span');
    const enemyTh = document.createElement('span');
    const enemyPos = document.createElement('span');
    const status = document.createElement('span');
    const scoreCell = document.createElement('span');

    if (!warDetail) {
        // ── FUTURE / UNKNOWN WAR ─────────────────────────────────────────────
        // No API data for this round yet — show dashes for all columns
        myPos.textContent = '-';
        stars.textContent = '-';
        dest.textContent = '-';
        enemyTh.textContent = '-';
        enemyPos.textContent = '-';
        status.textContent = '-';
        scoreCell.textContent = '-';
    } else {
        if (war.myPosition > 0) {
            // ── PLAYER IN LINEUP ──────────────────────────────────────────────
            // Hide position during prep day (API intentionally withholds this)
            myPos.textContent = isPrepDay ? '-' : war.myPosition;

            if (war.status === 'attacked') {
                // ── ATTACKED ──────────────────────────────────────────────────
                stars.textContent = war.stars;
                dest.textContent = `${war.destruction}%`;
                enemyTh.textContent = war.opponentTh > 0 ? war.opponentTh : '-'; // 0 means unknown
                enemyPos.textContent = war.opponentPosition > 0 ? war.opponentPosition : '-';
                status.textContent = 'Attacked';

                // Recalculate score live for display (not pulled from __computed,
                // so this modal always reflects the latest algorithm settings)
                const score = calculatePerformanceScore(player, war);
                scoreCell.textContent = round(score, appSettings.decimals);

            } else if (war.status === 'missed') {
                // ── MISSED ATTACK ─────────────────────────────────────────────
                stars.textContent = '0';
                dest.textContent = '0%';
                enemyTh.textContent = '-';
                enemyPos.textContent = '-';
                status.textContent = 'Missed';
                scoreCell.textContent = round(-20, appSettings.decimals); // Flat -20 penalty

            } else {
                // ── PENDING (in lineup, war active or prep, not yet attacked) ──
                stars.textContent = '-';
                dest.textContent = '-';
                enemyTh.textContent = '-';
                enemyPos.textContent = '-';
                // Show 'Prep' during preparation day, 'Pending' when war is live
                status.textContent = isPrepDay ? 'Prep' : 'Pending';
                scoreCell.textContent = '-';
            }

        } else {
            // ── PLAYER BENCHED (myPosition === 0) ─────────────────────────────
            myPos.textContent = '-';
            stars.textContent = '-';
            dest.textContent = '-';
            enemyTh.textContent = '-';
            enemyPos.textContent = '-';

            if (hasStarted) {
                // War started and player wasn't in lineup → confirmed bench with 0 score
                status.textContent = 'Benched';
                scoreCell.textContent = '0'; // Bench counts as 0 in scoring
            } else {
                // Prep or future — not yet known if they'll be benched
                status.textContent = '-';
                scoreCell.textContent = '-';
            }
        }
    }

    row.append(warLabel, myPos, stars, dest, enemyTh, enemyPos, status, scoreCell);
    return row;
}

/**
 * FUNCTION: openWarsEditor
 * PURPOSE: Creates and displays the attack data viewer modal for a given player.
 *          Renders all 7 war day rows using createWarRowDisplay(). Includes
 *          prev/next navigation buttons to cycle through players without closing.
 *
 * @param originalPlayerIndex - Index of the player in the state.players array.
 *                              Must be looked up fresh from state at click time.
 *
 * SIDE EFFECTS:
 *   - Closes any existing attack editor modal first (prevents duplicates)
 *   - Creates and appends a new modal to the DOM via openModal()
 *   - Modal is dismissed on backdrop click or the Close button
 *   - Prev/Next buttons call openWarsEditor() recursively with adjacent index
 *
 * CALLED BY:
 *   - ui/main_view.js → createPlayerRowElement() → warsBtn.onclick
 */
export function openWarsEditor(originalPlayerIndex) {
    const { players } = getState();
    const player = players[originalPlayerIndex];
    if (!player) return;

    // Close any existing attack editor before opening a new one (avoid stacking)
    closeModal(document.querySelector('#attackEditorModal'));

    // Build the modal container
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.id = 'attackEditorModal';

    const handleClose = () => closeModal(modal);

    // Close on backdrop click (clicking outside the card)
    modal.onclick = (e) => { if (e.target === modal) handleClose(); };

    // Build the modal structure with header row labels
    modal.innerHTML = `
      <div class="modal-card">
        <h3>${player.name} - Attack Data</h3>
        <div class="modal-grid">
          <div class="modal-header"><span>War</span><span>My Pos</span><span>Stars</span><span>Dest. %</span><span>Enemy TH</span><span>Enemy Pos</span><span>Status</span><span>Score</span></div>
        </div>
        <div class="modal-actions"><button id="modalCloseBtn" class="btn btn-primary">Close</button></div>
      </div>
    `;

    // Generate one display row per war day and append them to the grid
    const warRowElements = player.wars.map((war, i) => createWarRowDisplay(player, war, i));
    modal.querySelector('.modal-grid').append(...warRowElements);
    modal.querySelector('#modalCloseBtn').onclick = handleClose;

    // ── PREV / NEXT NAVIGATION BUTTONS ────────────────────────────────────────
    // Allow cycling through players without closing the modal.
    // Disabled at the first/last player boundaries.
    const prevBtn = document.createElement('button');
    prevBtn.className = 'modal-nav-btn modal-nav-prev';
    prevBtn.innerHTML = `<img src="img/direction.png" alt="Previous">`;
    if(originalPlayerIndex > 0) prevBtn.onclick = () => openWarsEditor(originalPlayerIndex - 1);
    else prevBtn.disabled = true; // First player — no previous

    const nextBtn = document.createElement('button');
    nextBtn.className = 'modal-nav-btn modal-nav-next';
    nextBtn.innerHTML = `<img src="img/direction.png" alt="Next">`;
    if (originalPlayerIndex < players.length - 1) nextBtn.onclick = () => openWarsEditor(originalPlayerIndex + 1);
    else nextBtn.disabled = true; // Last player — no next

    modal.querySelector('.modal-card').append(prevBtn, nextBtn);
    openModal(modal);
}