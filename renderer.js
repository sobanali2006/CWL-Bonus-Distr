// renderer.js

import { loadInitialData } from './js_modules/state.js';
import { attachInitialEventListeners, triggerStartupFetch, updateFetchButtonState } from './js_modules/events.js';
import { cacheDOMElements } from './js_modules/ui/dom.js';
import { LEAGUES } from './js_modules/config.js'; 
import { initializeTooltips, initializeAccordion } from './js_modules/ui/components.js';

function populateLeagueSelect() {
    const leagueSelect = document.getElementById('leagueSelect');
    if (!leagueSelect) return;
    LEAGUES.forEach(league => {
        const option = document.createElement('option');
        option.value = league.id;
        option.textContent = league.name;
        leagueSelect.appendChild(option);
    });
}

// --- Application Entry Point ---
document.addEventListener('DOMContentLoaded', async () => {
    cacheDOMElements();
    populateLeagueSelect(); 
    initializeTooltips();
    initializeAccordion();
    attachInitialEventListeners();
    
    loadInitialData(); // Loads LocalStorage & populates Input
    updateFetchButtonState(); // Ensure button is correct state immediately
    
    // Trigger Auto-Fetch if tag exists
    await triggerStartupFetch();
});