import { v } from 'convex/values';

export interface TimeControl {
  baseTimeMs: number;
  incrementMs: number;
  delayMs: number;
}

export type TimeCategory = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence' | 'unlimited';

export interface TimeControlPreset {
  key: string;
  label: string;
  baseTimeMs: number;
  incrementMs: number;
  delayMs: number;
  category: TimeCategory;
}

export function parseTimeControlKey(key: string): TimeControl {
  if (key === 'unlimited') {
    return { baseTimeMs: 0, incrementMs: 0, delayMs: 0 }; // handled specially
  }

  const parts = key.split('_');
  if (parts.length >= 3) {
    const baseMins = parseInt(parts[1], 10);
    const incSecs = parseInt(parts[2], 10);
    
    if (!isNaN(baseMins) && !isNaN(incSecs)) {
      return {
        baseTimeMs: baseMins * 60 * 1000,
        incrementMs: incSecs * 1000,
        delayMs: 0 // Default to 0, custom strings can parse it if needed
      };
    }
  }

  // Fallback to something reasonable if custom or unparseable
  return { baseTimeMs: 5 * 60 * 1000, incrementMs: 0, delayMs: 0 };
}

export function estimatedGameDurationMs(tc: TimeControl, assumedMoves: number = 40): number {
  return tc.baseTimeMs + (assumedMoves * tc.incrementMs);
}

export function classifyOnline(tc: TimeControl): TimeCategory {
  if (tc.baseTimeMs === 0 && tc.incrementMs === 0 && tc.delayMs === 0) return 'unlimited';
  
  const estMins = estimatedGameDurationMs(tc) / (60 * 1000);
  
  if (estMins < 3) return 'bullet';
  if (estMins < 10) return 'blitz';
  return 'rapid'; // Simplified, typically rapid >= 10, classical much higher but this matches prompt requirement
}

export function classifyFIDE(tc: TimeControl): TimeCategory {
  if (tc.baseTimeMs === 0 && tc.incrementMs === 0 && tc.delayMs === 0) return 'unlimited';
  
  // FIDE: uses base + 60*increment
  const fideTimeMins = (tc.baseTimeMs + 60 * tc.incrementMs) / (60 * 1000);
  
  if (fideTimeMins < 3) return 'bullet'; // FIDE doesn't strictly have bullet, but for completeness
  if (fideTimeMins < 10) return 'blitz';
  if (fideTimeMins < 60) return 'rapid';
  return 'classical';
}

export const ALL_PRESETS: TimeControlPreset[] = [
  { key: 'bullet_1_0', label: '1+0', baseTimeMs: 60000, incrementMs: 0, delayMs: 0, category: 'bullet' },
  { key: 'bullet_1_1', label: '1+1', baseTimeMs: 60000, incrementMs: 1000, delayMs: 0, category: 'bullet' },
  { key: 'bullet_2_1', label: '2+1', baseTimeMs: 120000, incrementMs: 1000, delayMs: 0, category: 'bullet' },
  
  { key: 'blitz_3_0', label: '3+0', baseTimeMs: 180000, incrementMs: 0, delayMs: 0, category: 'blitz' },
  { key: 'blitz_3_2', label: '3+2', baseTimeMs: 180000, incrementMs: 2000, delayMs: 0, category: 'blitz' },
  { key: 'blitz_5_0', label: '5+0', baseTimeMs: 300000, incrementMs: 0, delayMs: 0, category: 'blitz' },
  { key: 'blitz_5_3', label: '5+3', baseTimeMs: 300000, incrementMs: 3000, delayMs: 0, category: 'blitz' },
  { key: 'blitz_5_5', label: '5+5', baseTimeMs: 300000, incrementMs: 5000, delayMs: 0, category: 'blitz' },
  
  { key: 'rapid_10_0', label: '10+0', baseTimeMs: 600000, incrementMs: 0, delayMs: 0, category: 'rapid' },
  { key: 'rapid_10_5', label: '10+5', baseTimeMs: 600000, incrementMs: 5000, delayMs: 0, category: 'rapid' },
  { key: 'rapid_15_10', label: '15+10', baseTimeMs: 900000, incrementMs: 10000, delayMs: 0, category: 'rapid' },
  { key: 'rapid_30_0', label: '30+0', baseTimeMs: 1800000, incrementMs: 0, delayMs: 0, category: 'rapid' },
  { key: 'rapid_30_30', label: '30+30', baseTimeMs: 1800000, incrementMs: 30000, delayMs: 0, category: 'rapid' },
  
  { key: 'classical_45_15', label: '45+15', baseTimeMs: 2700000, incrementMs: 15000, delayMs: 0, category: 'classical' },
  { key: 'classical_60_0', label: '60+0', baseTimeMs: 3600000, incrementMs: 0, delayMs: 0, category: 'classical' },
  { key: 'classical_90_30', label: '90+30', baseTimeMs: 5400000, incrementMs: 30000, delayMs: 0, category: 'classical' },
  
  { key: 'unlimited', label: 'Unlimited', baseTimeMs: 0, incrementMs: 0, delayMs: 0, category: 'unlimited' }
];

export function getPreset(key: string): TimeControlPreset | undefined {
  return ALL_PRESETS.find(p => p.key === key);
}

export function formatTimeControl(tc: TimeControl): string {
  if (tc.baseTimeMs === 0 && tc.incrementMs === 0 && tc.delayMs === 0) {
    return 'Unlimited';
  }
  
  const baseMins = Math.floor(tc.baseTimeMs / 60000);
  const baseSecs = Math.floor((tc.baseTimeMs % 60000) / 1000);
  const incSecs = tc.incrementMs / 1000;
  
  const baseStr = baseSecs > 0 ? `${baseMins}:${baseSecs.toString().padStart(2, '0')}` : `${baseMins}`;
  return `${baseStr}+${incSecs}`;
}
