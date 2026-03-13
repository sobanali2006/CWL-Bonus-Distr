// js_modules/calculator.js
import { config } from './config.js';
import { getState } from './state.js';

export function getPlayerStrength(th, position) {
    if (position === 0 || th === 0) return 0;
    const { warFormat } = getState();
    const rankMax = warFormat;
    const rankPoints = ((rankMax + 1 - position) / rankMax) * 65;
    const thPoints = config.TH_STRENGTH_MAP[th] || 0;
    return rankPoints + thPoints + config.POINTS_BUFFER;
}

export function calculatePerformanceScore(player, warData) {
    if (warData.myPosition === 0 || !warData.status || warData.status === '') return null;
    
    // ### DEFINITIVE FIX: Apply a -20 point penalty for missed attacks. ###
    if (warData.status === 'missed') return -20;
    
    let starScore = 0;
    if (warData.stars === 1) starScore = 40;
    else if (warData.stars === 2) starScore = 70;
    else if (warData.stars === 3) starScore = 80;
    
    const destructionBonus = (warData.destruction || 0) * 0.2;
    const baseAttackScore = starScore + destructionBonus;
    
    const attackerPPS = getPlayerStrength(player.th, warData.myPosition);
    const defenderPPS = getPlayerStrength(warData.opponentTh, warData.opponentPosition);
    
    if (attackerPPS === 0 || defenderPPS === 0) return 0;
    
    const difficultyMultiplier = defenderPPS / attackerPPS;
    return baseAttackScore * difficultyMultiplier;
}