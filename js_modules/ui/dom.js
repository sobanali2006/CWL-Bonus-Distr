// js_modules/ui/dom.js

export const dom = {};

export function cacheDOMElements() {
    // API Controls
    dom.clanTagInput = document.getElementById('clanTagInput');
    dom.fetchDataBtn = document.getElementById('fetchDataBtn');
    
    // Main UI
    dom.playersBody = document.getElementById('playersBody');
    dom.rankingsBody = document.getElementById('rankingsBody');
    dom.resetDataBtn = document.getElementById('resetDataBtn');
    dom.exportDataBtn = document.getElementById('exportDataBtn');
    dom.importDataBtn = document.getElementById('importDataBtn');
    dom.cwlFinishedCheckbox = document.getElementById('cwlFinishedCheckbox');
    dom.warsWonSelect = document.getElementById('warsWonSelect');
    dom.warsWonContainer = document.getElementById('warsWonContainer');
    dom.leagueSelect = document.getElementById('leagueSelect');
    dom.bonusHeaderTh = document.getElementById('bonusHeaderTh');
    dom.bonusCountDisplay = document.getElementById('bonusCountDisplay');
    
    // Identity
    dom.clanIdentityDisplay = document.getElementById('clanIdentityDisplay');

    // Settings
    dom.decimalPlacesSelect = document.getElementById('decimalPlacesSelect');
    dom.bestAttacksSelect = document.getElementById('bestAttacksSelect');
    dom.autoRefreshSelect = document.getElementById('autoRefreshSelect');
    
    // NEW Toggles
    dom.hideNonCwlCheckbox = document.getElementById('hideNonCwlCheckbox');
    dom.hideBenchCheckbox = document.getElementById('hideBenchCheckbox');

    dom.emptyStateContainer = document.getElementById('emptyStateContainer');
    dom.playerRosterContainer = document.getElementById('playerRosterContainer');
    dom.rankingsSection = document.getElementById('rankingsSection');
    dom.confirmationModal = document.getElementById('confirmationModal');
    dom.confirmModalMessage = document.getElementById('confirmModalMessage');
    dom.confirmBtn = document.getElementById('confirmBtn');
    dom.cancelBtn = document.getElementById('cancelBtn');
    dom.tooltip = document.getElementById('tooltip');
    dom.parchmentContainer = document.getElementById('parchmentContainer');
    dom.sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    
    dom.rosterControlsWrapper = document.querySelector('.roster-controls-wrapper');
    dom.warDaySelectorContainer = document.getElementById('warDaySelectorContainer');
    dom.format15v15Radio = document.getElementById('format15v15');
    // activeDayControlContainer removed from DOM usage
}