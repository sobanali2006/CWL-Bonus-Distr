/**
 * FILE: modal_lineup_editor.js
 * PROCESS: Renderer
 * ROLE: War day lineup viewer modal. Shows side-by-side clan vs enemy lineups
 *       for a given war day. Our clan lineup includes traffic light attack
 *       status indicators (green/red/white). Enemy lineup is hidden during
 *       preparation day.
 *
 * DEPENDENCIES:
 *   - state.js:      getState() — reads players, cwlWarDetails, warFormat
 *   - ui/components.js: openModal(), closeModal()
 *
 * EXPORTS:
 *   - openLineupEditor(dayIndex): Open the lineup viewer for a specific war day
 *
 * DOCS:
 *   - docs/architecture/data-flow.md → Flow 1 (lineup viewer is read-only)
 *   - docs/changelogs/v1.1.0.md → Traffic Light Indicators, Preparation Day
 */

import { getState } from '../state.js';
import { openModal, closeModal } from './components.js';

/**
 * FUNCTION: getLineupForDay
 * PURPOSE: Returns the lineup for one side (our clan or the enemy) for a given
 *          war day. Prioritizes rich API data over manual position data.
 *
 * @param dayIndex  - 0-6: which war day to look up
 * @param clanType  - 'clan' (our side) | 'opponent' (enemy side)
 * @param warFormat - 15 or 30 (used for fallback manual data only)
 * @returns {Array|'PREPARATION'|[]}
 *   - Array of { id?, name, th, position } objects sorted by position
 *   - 'PREPARATION' string: war exists but enemy lineup is hidden (prep day)
 *   - Empty array []: no data available for this side
 *
 * DATA PRIORITY:
 *   1. API data (cwlWarDetails[dayIndex]): Used if available — most accurate.
 *      Enemy lineup is hidden during preparation → returns 'PREPARATION' sentinel.
 *   2. Manual fallback (player.wars[dayIndex].myPosition): Used only if no API
 *      data exists. Only available for our clan side (not enemy).
 *
 * CALLED BY: modal_lineup_editor.js → openLineupEditor()
 */
function getLineupForDay(dayIndex, clanType, warFormat) {
    const { players, cwlWarDetails } = getState();

    // ── PRIORITY 1: API DATA ────────────────────────────────────────────────
    const war = cwlWarDetails && cwlWarDetails[dayIndex];

    if (war && war.clan && war.opponent) {
        if (clanType === 'clan') {
            // Return our clan's lineup from the API (always available once war data loads)
            return war.clan.members.map(m => ({
                id: m.tag,           // Tag used to look up attack status in players state
                name: m.name,
                th: m.townhallLevel,
                position: m.mapPosition
            })).sort((a, b) => a.position - b.position);

        } else {
            // Enemy lineup: hidden during preparation day (CoC API rule)
            if (war.state === 'preparation') return 'PREPARATION'; // Sentinel value

            // Return enemy lineup after preparation day ends
            return war.opponent.members.map(m => ({
                name: m.name,
                th: m.townhallLevel,
                position: m.mapPosition
            })).sort((a, b) => a.position - b.position);
        }
    }

    // ── PRIORITY 2: MANUAL FALLBACK ────────────────────────────────────────
    // API data not available — fall back to manually-tracked position data.
    // Only available for our clan side (enemy positions are never manually tracked).
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
    return []; // No enemy data available without API
}

/**
 * FUNCTION: openLineupEditor
 * PURPOSE: Creates and displays the war day lineup viewer modal. Shows clan and
 *          enemy lineups side by side with TH icons. Our lineup includes traffic
 *          light status indicators per player. Enemy lineup shows a message during
 *          preparation day instead of player names.
 *
 * @param dayIndex - 0-6: which war day lineup to display
 *
 * TRAFFIC LIGHT LOGIC (our clan side only):
 *   - Green circle  (status-green):  player.wars[dayIndex].status === 'attacked'
 *   - Red circle    (status-red):    player.wars[dayIndex].status === 'missed'
 *   - White circle  (status-white):  any other status (pending / prep)
 *   The player object is looked up from state by matching member.id (tag).
 *
 * PREPARATION DAY HANDLING:
 *   If getLineupForDay returns 'PREPARATION' for the enemy side, the enemy
 *   column shows an italic message instead of player names.
 *
 * SIDE EFFECTS:
 *   - Closes any existing lineup editor first
 *   - Creates and appends modal to DOM via openModal()
 *   - Dismissed on Close button click
 *
 * CALLED BY:
 *   - ui/main_view.js → renderDynamicControls() → war day button onclick
 *   - events.js → warDaySelectorContainer click delegation
 */
export function openLineupEditor(dayIndex) {
    const { warFormat, cwlWarDetails, players } = getState();

    // Close any existing lineup editor before opening a new one
    closeModal(document.getElementById('lineupEditorModal'));

    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.id = 'lineupEditorModal';

    const handleClose = () => closeModal(modal);

    // Get lineups for both sides using the priority-based data lookup
    const ourLineup = getLineupForDay(dayIndex, 'clan', warFormat);
    const enemyLineup = getLineupForDay(dayIndex, 'opponent', warFormat);

    // If our lineup is empty (no data at all), show a minimal error state modal
    if (!ourLineup || ourLineup.length === 0) {
        modal.innerHTML = `<div class="modal-card"><h3>War Day ${dayIndex + 1}</h3><p class="confirm-message">Roster data for this day is not available.</p><div class="modal-actions"><div class="modal-actions-right"><button id="closeBtn" class="btn btn-primary">Close</button></div></div></div>`;
        openModal(modal);
        modal.querySelector('#closeBtn').onclick = handleClose;
        return;
    }

    // Build the two-column lineup layout
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
                        <!-- Enemy content injected below based on war state -->
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

    /**
     * Helper: Returns an <img> tag HTML string for a TH icon.
     * Returns empty string for TH level 0 (unknown/missing).
     */
    const getThIcon = (th) => {
        if (th > 0) {
            return `<img src="img/th${th}.png" alt="TH ${th}" class="th-selector-icon">`;
        }
        return ''; // No icon for unknown TH level
    };

    // ── OUR CLAN LINEUP ──────────────────────────────────────────────────────
    ourLineup.forEach((member, index) => {
        // Position number (1-indexed)
        const numberDiv = document.createElement('div');
        numberDiv.className = 'lineup-position';
        numberDiv.textContent = `${index + 1}.`;
        yourNumbersCol.appendChild(numberDiv);

        const playerButton = document.createElement('div');
        playerButton.className = 'player-item-button';

        // ── TRAFFIC LIGHT STATUS INDICATOR ────────────────────────────────────
        // Look up the player's attack status from the live players state.
        // member.id = player tag (from API) or player.id (from manual data).
        let statusHtml = '';
        const playerObj = players.find(p => p.id === member.id);
        if (playerObj) {
            const warData = playerObj.wars[dayIndex];

            if (warData.status === 'attacked') {
                // Green: successfully attacked
                statusHtml = '<span class="status-circle status-green"></span>';
            } else if (warData.status === 'missed') {
                // Red: missed their attack (war ended without attacking)
                statusHtml = '<span class="status-circle status-red"></span>';
            } else {
                // White: pending (in lineup but hasn't attacked yet, or prep day)
                statusHtml = '<span class="status-circle status-white"></span>';
            }
        }

        playerButton.innerHTML = `<span class="lineup-player-name">${member.name} ${statusHtml}</span>${getThIcon(member.th)}`;
        yourPlayersCol.appendChild(playerButton);
    });

    // ── ENEMY LINEUP ─────────────────────────────────────────────────────────
    if (enemyLineup === 'PREPARATION') {
        // Preparation day: CoC API hides the enemy lineup intentionally.
        // Show a centered message instead of player names.
        enemyContainer.style.display = 'flex';
        enemyContainer.style.alignItems = 'center';
        enemyContainer.style.justifyContent = 'center';
        enemyContainer.innerHTML = `<p style="text-align: center; color: var(--color-ink-light); font-style: italic;">Enemy lineup is hidden during Preparation Day.</p>`;
    } else {
        // War is live or ended — show the enemy lineup normally
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
            // No traffic light for enemy — we only track our own attacks
            playerButton.innerHTML = `<span class="lineup-player-name">${player.name}</span>${getThIcon(player.th)}`;
            enemyPlayersCol.appendChild(playerButton);
        });
    }

    modal.querySelector('#closeBtn').onclick = handleClose;
    openModal(modal);
}