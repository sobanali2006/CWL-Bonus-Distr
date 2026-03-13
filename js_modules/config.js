// js_modules/config.js

export const LEAGUES = [
    { id: 'champ1', name: 'Champion I', base: 4 }, { id: 'champ2', name: 'Champion II', base: 4 }, { id: 'champ3', name: 'Champion III', base: 4 },
    { id: 'master1', name: 'Master I', base: 3 }, { id: 'master2', name: 'Master II', base: 3 }, { id: 'master3', name: 'Master III', base: 3 },
    { id: 'crystal1', name: 'Crystal I', base: 2 }, { id: 'crystal2', name: 'Crystal II', base: 2 }, { id: 'crystal3', name: 'Crystal III', base: 2 },
    { id: 'gold1', name: 'Gold I', base: 2 }, { id: 'gold2', name: 'Gold II', base: 2 }, { id: 'gold3', name: 'Gold III', base: 2 },
    { id: 'silver1', name: 'Silver I', base: 1 }, { id: 'silver2', name: 'Silver II', base: 1 }, { id: 'silver3', name: 'Silver III', base: 1 },
    { id: 'bronze1', name: 'Bronze I', base: 1 }, { id: 'bronze2', name: 'Bronze II', base: 1 }, { id: 'bronze3', name: 'Bronze III', base: 1 },
];

export const config = {
  numWars: 7,
  POINTS_BUFFER: 100,
  // ### DEFINITIVE FIX: Updated with the new TH18 scale. ###
  TH_STRENGTH_MAP: {
    18: 35,
    17: 31.18,
    16: 28,
    15: 25.73,
    14: 23.25,
    13: 20.63,
    12: 17.37,
    11: 15.39,
    10: 12.34,
    9: 9.9,
    8: 6.31,
    7: 5.02,
    6: 2.57,
    5: 1.37,
    4: 0.9,
    3: 0.3,
    2: 0.21,
    1: 0.05
  },
  localStorageKey: 'cwl_players_v5',
  settingsStorageKey: 'cwl_settings_v1',
  cwlFinishedKey: 'cwl_finished_status',
  warsWonKey: 'cwl_wars_won',
  cwlLeagueKey: 'cwl_league_id',
  warFormatKey: 'cwl_war_format',
};