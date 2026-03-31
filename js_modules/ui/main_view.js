/**
 * FILE: main_view.js
 * PROCESS: Renderer
 * ROLE: Renders the two main data tables (players roster + bonus/rankings) and
 *       manages UI visibility for major page sections. Does not mutate state —
 *       reads from getState() and calls state functions only through user-triggered
 *       handlers in the rendered rows.
 *
 * DEPENDENCIES:
 *   - state.js:          getState(), saveAppState(), deletePlayer(), setActiveDayForNav()
 *   - config.js:         LEAGUES — for league name lookup in the rankings display
 *   - ui/components.js:  round(), createTd(), showConfirmationModal()
 *   - ui/th_selector.js: createThSelector() — custom TH level dropdown
 *   - ui/modal_attackdata_editor.js: openWarsEditor() — per-player war stats modal
 *   - ui/modal_lineup_editor.js:     openLineupEditor() — war day lineup modal
 *   - ui/dom.js:         dom — cached DOM refs
 *
 * EXPORTS:
 *   - updateUIVisibility(): Show/hide major sections based on player data presence
 *   - renderPlayersTable(): Rebuild the full players roster table
 *   - renderRankingsTable(): Rebuild the bonus/rankings table, handle season summary card
 *
 * DOCS:
 *   - docs/architecture/data-flow.md → Flow 1 (computeAll calls these at end)
 */

import { getState, saveAppState, deletePlayer, setActiveDayForNav } from '../state.js';
import { LEAGUES } from '../config.js';
import { round, createTd, showConfirmationModal } from './components.js';
import { createThSelector } from './th_selector.js';
import { openWarsEditor } from './modal_attackdata_editor.js';
import { openLineupEditor } from './modal_lineup_editor.js';
import { dom } from './dom.js';

// ── DYNAMIC CONTROLS ──────────────────────────────────────────────────────────

/**
 * FUNCTION: renderDynamicControls
 * PURPOSE: Rebuilds the war day selector button strip. Renders 7 buttons (War Day 1
 *          through War Day 7) and highlights the currently live war day with a
 *          special CSS class. Each button opens the lineup viewer for that day.
 *
 * SIDE EFFECTS:
 *   - Clears and re-renders dom.warDaySelectorContainer
 *
 * CALLED BY: main_view.js → updateUIVisibility() (which is called by computeAll)
 */
function renderDynamicControls() {
    const { players, activeDayForNav, currentLiveDayIndex } = getState();
    const hasPlayers = players.length > 0;

    dom.warDaySelectorContainer.innerHTML = ''; // Clear previous buttons

    if (hasPlayers) {
        for (let i = 0; i < 7; i++) {
            const btn = document.createElement('button');
            btn.className = 'war-day-btn';

            // Highlight the currently live war day (e.g., "inWar" state from API)
            if (i === currentLiveDayIndex) {
                btn.classList.add('active-live-war');
            }

            btn.dataset.dayIndex = i;
            btn.textContent = `War Day ${i + 1}`;
            btn.onclick = () => openLineupEditor(i); // Open lineup viewer on click
            dom.warDaySelectorContainer.appendChild(btn);
        }
    }
}

// ── UI SECTION VISIBILITY ─────────────────────────────────────────────────────

/**
 * FUNCTION: updateUIVisibility
 * PURPOSE: Toggles the major UI sections based on whether players data exists.
 *          Also renders the clan identity bar (badge + name + league pill) if
 *          clanMeta is available.
 *
 * VISIBILITY LOGIC:
 *   - No players: show emptyStateContainer, hide player/rankings sections
 *   - Has players: show player/rankings sections, hide empty state
 *   - clanMeta available: render badge, name, league pill in clanIdentityDisplay
 *
 * SIDE EFFECTS:
 *   - Toggles .hidden class on multiple DOM sections
 *   - Conditionally builds and injects clan identity elements
 *   - Calls renderDynamicControls() to rebuild war day buttons
 *
 * CALLED BY: state.js → computeAll() (always called first in the pipeline)
 */
export function updateUIVisibility() {
    const { players, clanMeta } = getState();
    const hasPlayers = players.length > 0;

    renderDynamicControls(); // Always rebuild war day buttons when visibility updates

    // Toggle major sections based on data presence
    dom.emptyStateContainer.classList.toggle('hidden', hasPlayers);
    dom.playerRosterContainer.classList.toggle('hidden', !hasPlayers);
    dom.rankingsSection.classList.toggle('hidden', !hasPlayers);
    dom.rosterControlsWrapper.classList.toggle('hidden', !hasPlayers);

    // Render the clan identity bar if we have clanMeta from the API
    if (hasPlayers && clanMeta && dom.clanIdentityDisplay) {
        dom.clanIdentityDisplay.innerHTML = ''; // Clear previous identity display

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
        dom.clanIdentityDisplay.classList.add('hidden'); // No data — hide identity bar
    }
}

// ── PLAYERS TABLE ─────────────────────────────────────────────────────────────

/**
 * FUNCTION: createPlayerRowElement
 * PURPOSE: Builds a single <tr> element for the players roster table.
 *          Each row shows: serial number, name, TH selector, attack data button,
 *          total score, participations, avg performance, total stars, and rank.
 *
 * @param player - Player object from state (with __computed already populated)
 * @param index  - Display index (0-based, shown as serial number in first column)
 * @returns HTMLTableRowElement
 *
 * ROW CLASSES:
 *   - 'row-active': Player is in the lineup for the currently active war day
 *   - 'row-bench':  Player is benched for the currently active war day
 *   - (none):       Overview mode — no active day selected
 *
 * CALLED BY: main_view.js → renderPlayersTable()
 */
function createPlayerRowElement(player, index) {
    const { appSettings, activeDayForNav } = getState();
    const tr = document.createElement('tr');
    tr.dataset.playerId = player.id;

    // Apply active/bench row styling when viewing a specific war day
    if (activeDayForNav !== -1) {
        if (player.wars[activeDayForNav] && player.wars[activeDayForNav].myPosition > 0) {
            tr.className = 'row-active'; // In the lineup for this war day
        } else {
            tr.className = 'row-bench';  // Benched for this war day
        }
    }

    // Column 1: Serial number (display index, not stable ID)
    const tdSerial = createTd();
    tdSerial.textContent = index + 1;
    tr.appendChild(tdSerial);

    // Column 2: Player name
    const tdName = createTd();
    tdName.textContent = player.name;
    tr.appendChild(tdName);

    // Column 3: Town Hall level — custom TH selector widget (image + dropdown)
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

    // Column 4: Attack data button — opens the per-player war stats modal
    const tdWars = createTd();
    const warsBtn = document.createElement('button');
    warsBtn.className = 'btn btn-icon-edit btn-icon-stats';
    warsBtn.setAttribute('aria-label', `View attack data for ${player.name}`);
    warsBtn.onclick = () => {
        // Always look up the current index from state at click time
        // (index may have changed if rows were added/deleted or sorted)
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

    // Columns 5-8: Computed stats (read from __computed, formatted with round())
    tr.appendChild(createTd()).textContent = round(player.__computed?.totalPerfScore, appSettings.decimals);
    tr.appendChild(createTd()).textContent = round(player.__computed?.participations, 0);
    tr.appendChild(createTd()).textContent = round(player.__computed?.avgPerformance, appSettings.decimals);
    tr.appendChild(createTd()).textContent = round(player.__computed?.totalStars, 0);

    // Column 9: Current overall rank (dense ranking — tied players share a rank)
    tr.appendChild(createTd()).textContent = player.__computed?.currentRank ?? '-';

    return tr;
}

/**
 * FUNCTION: renderPlayersTable
 * PURPOSE: Clears and rebuilds the players roster table with the current filtered
 *          and sorted player list. Applies the filter chain (hideNonCwl, hideBench)
 *          and adds a visual separator row after the lineup boundary when viewing
 *          a specific war day.
 *
 * FILTER CHAIN:
 *   1. hideNonCwl: exclude players where p.isCwlMember === false
 *   2. hideBench:
 *      - In war day view (activeDayForNav !== -1): exclude CWL members with position 0
 *      - In overview (activeDayForNav === -1): exclude players with 0 participations
 *
 * SEPARATOR ROW:
 *   When viewing a specific war day without hide filters active, a visual separator
 *   is added after position warFormat (e.g., position 15 in 15v15) to divide
 *   the lineup from the bench.
 *
 * SIDE EFFECTS:
 *   - Clears and re-renders dom.playersBody
 *
 * CALLED BY: state.js → computeAll()
 */
export function renderPlayersTable() {
    const { players, appSettings, activeDayForNav, warFormat } = getState();
    dom.playersBody.innerHTML = '';

    // ── FILTER CHAIN ─────────────────────────────────────────────────────────
    const playersToRender = players.filter(p => {
        // Filter 1: Hide players not in the CWL season roster
        if (appSettings.hideNonCwl && !p.isCwlMember) return false;

        // Filter 2: Hide benched players
        if (appSettings.hideBench) {
            if (activeDayForNav !== -1) {
                // War day view: hide CWL members who are benched for THIS specific day
                if (p.isCwlMember && p.wars[activeDayForNav].myPosition === 0) return false;
            } else {
                // Overview: hide any player with zero total participations across all wars
                if ((p.__computed?.participations || 0) === 0) return false;
            }
        }
        return true;
    });

    playersToRender.forEach((p, index) => {
        const row = createPlayerRowElement(p, index);

        // Add a visual separator after the war lineup boundary (warFormat = # of lineup spots)
        // Only shown when filters are inactive (so all players are visible)
        if (activeDayForNav !== -1 && !appSettings.hideBench && !appSettings.hideNonCwl) {
            if (index === warFormat - 1) {
                row.classList.add('row-separator'); // CSS adds a bottom border after this row
            }
        }

        dom.playersBody.appendChild(row);
    });
}

// ── RANKINGS TABLE ────────────────────────────────────────────────────────────

/**
 * FUNCTION: renderRankingsTable
 * PURPOSE: Rebuilds the bonus/rankings table. When CWL is finished, also:
 *   - Hides the manual controls section (.cwl-status-controls)
 *   - Injects the season summary card (league name, win/loss, bonuses available)
 *   - Shows the "Bonus Given" column with checkboxes limited to bonusCount
 *
 * SEASON SUMMARY CARD LOGIC:
 *   - cwlFinished === true → hide manual controls, show/update #seasonSummaryCard
 *   - cwlFinished === false → show manual controls, remove #seasonSummaryCard if present
 *
 * BONUS CHECKBOX LOGIC:
 *   - Only shown when cwlFinished is true
 *   - Checkboxes are disabled once bonusesCurrentlyChecked >= bonusCount
 *   - Already-checked players remain checked (their checkbox stays enabled so they can uncheck)
 *
 * SIDE EFFECTS:
 *   - Clears and re-renders dom.rankingsBody
 *   - Shows/hides .cwl-status-controls and #seasonSummaryCard
 *   - Toggles dom.bonusHeaderTh visibility
 *
 * CALLED BY: state.js → computeAll()
 */
export function renderRankingsTable() {
    const { players, cwlFinished, warsWon, bonusCount, clanMeta, appSettings } = getState();
    dom.rankingsBody.innerHTML = '';

    // ── SEASON SUMMARY CARD LOGIC ─────────────────────────────────────────────
    const controlsContainer = document.querySelector('.cwl-status-controls');

    if (cwlFinished) {
        // CWL is finished → hide the manual controls and show the summary card
        controlsContainer.style.display = 'none';

        // Create the summary card if it doesn't exist yet; otherwise reuse it
        let summaryCard = document.getElementById('seasonSummaryCard');
        if (!summaryCard) {
            summaryCard = document.createElement('div');
            summaryCard.id = 'seasonSummaryCard';
            summaryCard.className = 'season-summary-card';
            // Insert immediately after the hidden controls container
            controlsContainer.parentNode.insertBefore(summaryCard, controlsContainer.nextSibling);
        }

        // Populate the summary with current season stats
        const leagueName = clanMeta?.leagueName || "Unknown League";
        summaryCard.innerHTML = `
            <div class="season-summary-title">Season Complete: ${leagueName}</div>
            <div class="season-summary-stats">${warsWon} Wins • ${7 - warsWon} Losses</div>
            <div class="season-summary-bonus">${bonusCount} Bonuses Available</div>
        `;

        // Show the "Bonus" column header in the rankings table
        dom.bonusHeaderTh.classList.remove('hidden');
        dom.bonusCountDisplay.textContent = ''; // Summary card now shows the count
    } else {
        // CWL not finished → show manual controls, hide/remove summary card
        controlsContainer.style.display = 'flex';
        const summaryCard = document.getElementById('seasonSummaryCard');
        if(summaryCard) summaryCard.remove();

        // Hide the "Bonus" column header when not finished (no bonuses to assign yet)
        dom.bonusHeaderTh.classList.add('hidden');
    }

    // ── RANKINGS + BONUS TABLE ─────────────────────────────────────────────────
    // Clear any stale finalPosition values from previous render
    players.forEach(p => { if(p.__computed) p.__computed.finalPosition = undefined; });

    // Only rank players who actually participated (have at least one scored war)
    const participatingPlayers = players.filter(p => p.__computed.participations > 0);

    // Assign final positions using dense ranking (tied players share the same position)
    const sortedByScore = [...participatingPlayers].sort((a, b) => (b.__computed.avgPerformance || 0) - (a.__computed.avgPerformance || 0));
    let currentPosition = 0, lastScore = -Infinity;
    sortedByScore.forEach((p, idx) => {
        // Use toFixed(5) comparison to avoid floating-point equality issues
        if (p.__computed.avgPerformance.toFixed(5) !== lastScore) { currentPosition = idx + 1; }
        p.__computed.finalPosition = currentPosition;
        lastScore = p.__computed.avgPerformance.toFixed(5);
    });
    const rankedPlayers = sortedByScore.sort((a,b) => (a.__computed.finalPosition || Infinity) - (b.__computed.finalPosition || Infinity));

    // Track how many bonus checkboxes are currently checked
    // (used to disable unchecked checkboxes once the limit is reached)
    let bonusesCurrentlyChecked = players.filter(pl => pl.isBonusGiven).length;

    // Build one row per ranked player
    rankedPlayers.forEach(p => {
        const tr = document.createElement('tr');

        // Column 1: Rank with trophy icon for top 3
        const tdRank = createTd();
        const rankContainer = document.createElement('div');
        rankContainer.className = 'rank-cell-content';
        const rankSpan = document.createElement('span');
        rankSpan.textContent = p.__computed?.finalPosition ?? '-';
        rankContainer.appendChild(rankSpan);
        tdRank.appendChild(rankContainer);

        // Add gold/silver/bronze trophy icons for top 3 positions
        if (p.__computed?.finalPosition === 1) { rankSpan.classList.add('rank-gold'); const icon=document.createElement('img'); icon.src='img/gold-trophy.png'; icon.className='rank-icon'; rankContainer.appendChild(icon); }
        else if (p.__computed?.finalPosition === 2) { rankSpan.classList.add('rank-silver'); const icon=document.createElement('img'); icon.src='img/silver-trophy.png'; icon.className='rank-icon'; rankContainer.appendChild(icon); }
        else if (p.__computed?.finalPosition === 3) { rankSpan.classList.add('rank-bronze'); const icon=document.createElement('img'); icon.src='img/bronze-trophy.png'; icon.className='rank-icon'; rankContainer.appendChild(icon); }
        tr.appendChild(tdRank);

        // Columns 2-5: Name, participations, avg performance, total stars
        tr.appendChild(createTd()).textContent = p.name;
        tr.appendChild(createTd()).textContent = round(p.__computed?.participations, 0);
        tr.appendChild(createTd()).textContent = round(p.__computed?.avgPerformance, appSettings.decimals);
        tr.appendChild(createTd()).textContent = round(p.__computed?.totalStars, 0);

        // Column 6: Bonus checkbox — only visible when CWL is finished
        const tdBonus = createTd();

        if (cwlFinished) {
            tdBonus.classList.remove('hidden');
            const bonusCheckbox = document.createElement('input');
            bonusCheckbox.type = 'checkbox';
            const originalPlayer = players.find(pl => pl.id === p.id);
            bonusCheckbox.checked = originalPlayer.isBonusGiven;

            // Disable checkbox if the bonus limit has been reached AND this player isn't already checked
            // (allows unchecking an already-assigned bonus, but not assigning more than allowed)
            bonusCheckbox.disabled = !originalPlayer.isBonusGiven && bonusesCurrentlyChecked >= bonusCount;

            bonusCheckbox.onchange = (e) => {
                if (originalPlayer) { originalPlayer.isBonusGiven = e.target.checked; }
                saveAppState();
                renderRankingsTable(); // Re-render to update disabled states on other checkboxes
            };
            tdBonus.appendChild(bonusCheckbox);
        } else {
            tdBonus.classList.add('hidden'); // Season not finished — no bonuses to assign
        }

        tr.appendChild(tdBonus);
        dom.rankingsBody.appendChild(tr);
    });
}