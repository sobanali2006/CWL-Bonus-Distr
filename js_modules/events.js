// js_modules/events.js

import { getState, updateSetting, setWarFormat, resetAllData, exportData, importData, setCwlFinished, setWarsWon, setCwlLeague, setActiveDayForNav, processApiData, getSavedClanTag, saveAppState } from './state.js';
import { showConfirmationModal, closeModal, showToast } from './ui/components.js';
import { dom } from './ui/dom.js';
import { openLineupEditor } from './ui/modal_lineup_editor.js';

let refreshTimer = null;

export function updateFetchButtonState() {
    const currentInput = dom.clanTagInput.value.trim().toUpperCase();
    const savedTag = getSavedClanTag();

    if (currentInput.length < 2) {
        dom.fetchDataBtn.textContent = 'Import Data';
        dom.fetchDataBtn.className = 'btn btn-primary';
        dom.fetchDataBtn.disabled = true;
        return;
    }

    dom.fetchDataBtn.disabled = false;

    if (savedTag && currentInput === savedTag) {
        dom.fetchDataBtn.textContent = 'Refresh Data';
        dom.fetchDataBtn.className = 'btn btn-success';
    } else {
        dom.fetchDataBtn.textContent = 'Import Data';
        dom.fetchDataBtn.className = 'btn btn-primary';
    }
}

export async function triggerStartupFetch() {
    const savedTag = getSavedClanTag();
    if (savedTag) {
        await handleApiFetch(true); 
    }
}

export function setupAutoRefresh(minutes) {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    if (minutes <= 0) {
        console.log("Auto-Refresh: Only on Startup");
        return;
    }

    console.log(`Auto-Refresh enabled: Every ${minutes} minutes.`);
    refreshTimer = setInterval(() => {
        if (dom.clanTagInput.value.length > 2) {
            handleApiFetch(true); 
        }
    }, minutes * 60000);
}

export function attachInitialEventListeners() {
    dom.fetchDataBtn.addEventListener('click', () => handleApiFetch(false));
    
    dom.clanTagInput.addEventListener('input', (e) => {
        let value = e.target.value.toUpperCase();
        if (value.length > 0 && !value.startsWith('#')) {
            value = '#' + value.replace(/#/g, '');
        }
        e.target.value = value;
        updateFetchButtonState();
    });

    document.querySelectorAll('input[name="warFormat"]').forEach(radio => radio.addEventListener('change', (e) => setWarFormat(Number(e.target.value))));
    
    dom.resetDataBtn.addEventListener('click', () => showConfirmationModal('Are you absolutely sure you want to delete ALL data? This action cannot be undone!', resetAllData));
    
    dom.exportDataBtn.addEventListener('click', exportData);
    dom.importDataBtn.addEventListener('click', importData);
    
    dom.decimalPlacesSelect.addEventListener('change', (e) => updateSetting('decimals', Number(e.target.value)));
    dom.bestAttacksSelect.addEventListener('change', (e) => updateSetting('bestAttacksToAverage', Number(e.target.value)));
    
    dom.autoRefreshSelect.addEventListener('change', (e) => {
        const minutes = Number(e.target.value);
        updateSetting('autoRefreshInterval', minutes);
        setupAutoRefresh(minutes);
    });

    // NEW Toggles
    dom.hideNonCwlCheckbox.addEventListener('change', (e) => updateSetting('hideNonCwl', e.target.checked));
    dom.hideBenchCheckbox.addEventListener('change', (e) => updateSetting('hideBench', e.target.checked));
    
    dom.sidebarToggleBtn.addEventListener('click', () => { 
        dom.parchmentContainer.classList.toggle('sidebar-collapsed');
    });
    
    dom.cwlFinishedCheckbox.addEventListener('change', (e) => setCwlFinished(e.target.checked));
    dom.warsWonSelect.addEventListener('change', (e) => setWarsWon(Number(e.target.value)));
    dom.leagueSelect.addEventListener('change', (e) => setCwlLeague(e.target.value));

    dom.warDaySelectorContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('war-day-btn')) {
            const dayIndex = Number(e.target.dataset.dayIndex);
            openLineupEditor(dayIndex);
        }
    });

    document.addEventListener('keydown', handleGlobalKeydown);
}

async function handleApiFetch(isBackground = false) {
    const clanTag = dom.clanTagInput.value.trim();
    if (!clanTag || clanTag.length < 2) { 
        showToast('Please enter a valid Clan Tag.', 'error');
        return;
    }

    const savedTag = getSavedClanTag();
    const isImport = (!savedTag || savedTag !== clanTag);

    if (isImport) {
        showToast('Fetching clan data...', 'info', true);
    } else {
        showToast('Updating data...', 'info', true);
    }

    dom.fetchDataBtn.disabled = true;

    const result = await window.api.fetchClanData(clanTag);

    if (result.success) {
        console.log("--- RAW DATA RECEIVED BY FRONTEND ---", result.data); 
        processApiData(result.data);
        
        saveAppState(); 
        updateFetchButtonState();

        if (isImport) {
            showToast('Fetched clan data successfully!', 'success');
        } else {
            showToast('Updated clan data successfully!', 'success');
        }

    } else {
        showToast(`Error: ${result.error}`, 'error');
    }

    dom.fetchDataBtn.disabled = false;
    updateFetchButtonState(); 
}

function handleGlobalKeydown(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal-bg:not(.hidden)');
        if (modals.length > 0) {
            const topModal = modals[modals.length - 1];
            if (topModal.id === 'lineupChangesModal') {
                const cancelBtn = topModal.querySelector('#changesCancelBtn');
                cancelBtn?.click();
                return;
            }
            const dynamicCloseBtn = topModal.querySelector('#closeBtn, #modalCloseBtn');
            if (dynamicCloseBtn) {
                dynamicCloseBtn.click();
            } 
            else if (topModal.id === 'confirmationModal') {
                const confirmCancelBtn = topModal.querySelector('#cancelBtn');
                confirmCancelBtn?.click();
            }
        }
    }
}

export function applySettingsUI() {
    const { appSettings } = getState();
    dom.decimalPlacesSelect.value = appSettings.decimals;
    dom.bestAttacksSelect.value = appSettings.bestAttacksToAverage;
    
    if (dom.autoRefreshSelect) {
        dom.autoRefreshSelect.value = appSettings.autoRefreshInterval || 0;
        setupAutoRefresh(appSettings.autoRefreshInterval || 0);
    }

    // Update Toggles
    if (dom.hideNonCwlCheckbox) {
        dom.hideNonCwlCheckbox.checked = appSettings.hideNonCwl || false;
    }
    if (dom.hideBenchCheckbox) {
        dom.hideBenchCheckbox.checked = appSettings.hideBench || false;
    }

    const tooltipText = "Mean of the player’s attacks, based on the number selected in settings.";
    document.querySelectorAll('th[data-tooltip="Average Performance Score"]').forEach(header => {
        header.dataset.tooltip = tooltipText;
    });
}