import { test, expect, describe } from 'vitest';
import { parseTimeControlKey, estimatedGameDurationMs, classifyOnline, classifyFIDE, formatTimeControl, ALL_PRESETS, getPreset } from '../lib/timeControl';
import { initClock, applyMoveToClockServer, getServerClockSnapshot, isTimedOut, determineTimeoutResult } from '../lib/clockEngine';

describe('timeControl.ts', () => {
  test('parseTimeControlKey parses valid keys', () => {
    expect(parseTimeControlKey('blitz_5_3')).toEqual({ baseTimeMs: 300000, incrementMs: 3000, delayMs: 0 });
    expect(parseTimeControlKey('bullet_1_0')).toEqual({ baseTimeMs: 60000, incrementMs: 0, delayMs: 0 });
    expect(parseTimeControlKey('unlimited')).toEqual({ baseTimeMs: 0, incrementMs: 0, delayMs: 0 });
  });

  test('estimatedGameDurationMs calculates correctly', () => {
    const tc = { baseTimeMs: 300000, incrementMs: 3000, delayMs: 0 };
    expect(estimatedGameDurationMs(tc, 40)).toBe(300000 + 40 * 3000);
  });

  test('classifyOnline assigns correct categories', () => {
    expect(classifyOnline({ baseTimeMs: 60000, incrementMs: 0, delayMs: 0 })).toBe('bullet');
    expect(classifyOnline({ baseTimeMs: 180000, incrementMs: 2000, delayMs: 0 })).toBe('blitz'); // 3 mins + (40 * 2s) = 3m 80s = 4.33 mins (blitz)
    expect(classifyOnline({ baseTimeMs: 600000, incrementMs: 0, delayMs: 0 })).toBe('rapid'); // 10 mins
  });

  test('classifyFIDE assigns correct categories', () => {
    expect(classifyFIDE({ baseTimeMs: 180000, incrementMs: 2000, delayMs: 0 })).toBe('blitz');
    expect(classifyFIDE({ baseTimeMs: 3500000, incrementMs: 0, delayMs: 0 })).toBe('rapid'); // < 60 mins
    expect(classifyFIDE({ baseTimeMs: 3600000, incrementMs: 0, delayMs: 0 })).toBe('classical'); 
  });
});

describe('clockEngine.ts', () => {
  test('initClock initializes properly', () => {
    const state = initClock({ baseTimeMs: 300000, incrementMs: 3000, delayMs: 0 });
    expect(state.whiteTimeMs).toBe(300000);
    expect(state.blackTimeMs).toBe(300000);
    expect(state.activeColor).toBe('w');
    expect(state.moveCount).toBe(0);
    expect(state.clockVersion).toBe(0);
  });

  test('applyMoveToClockServer deducts time and adds increment', () => {
    let state = initClock({ baseTimeMs: 300000, incrementMs: 3000, delayMs: 0 });
    state.lastTickAt = 1000;
    
    // white moves at 3000. Elapsed: 2000ms. New time: 300000 - 2000 + 3000 = 301000.
    state = applyMoveToClockServer(state, { baseTimeMs: 300000, incrementMs: 3000, delayMs: 0 }, 3000);
    
    expect(state.whiteTimeMs).toBe(301000);
    expect(state.blackTimeMs).toBe(300000);
    expect(state.activeColor).toBe('b');
    expect(state.lastTickAt).toBe(3000);
    expect(state.moveCount).toBe(1);
    expect(state.clockVersion).toBe(1);
  });

  test('applyMoveToClockServer with Bronstein delay', () => {
    let state = initClock({ baseTimeMs: 300000, incrementMs: 3000, delayMs: 2000 });
    state.lastTickAt = 1000;
    
    // white moves at 3500. Elapsed: 2500ms. Delay is 2000ms. Effective: 500ms. 
    // Time before increment: 300000 - 500 = 299500. Increment: 3000. Final: 302500.
    state = applyMoveToClockServer(state, { baseTimeMs: 300000, incrementMs: 3000, delayMs: 2000 }, 3500);
    expect(state.whiteTimeMs).toBe(302500);
    
    // what if elapsed < delay?
    state.lastTickAt = 4000; // Reset lastTickAt manually to simulate next turn
    state.activeColor = 'w';
    // moves at 5000. Elapsed: 1000ms. Delay: 2000ms. Effective: 0. Time before increment: 302500. Final: 305500.
    state = applyMoveToClockServer(state, { baseTimeMs: 300000, incrementMs: 3000, delayMs: 2000 }, 5000);
    expect(state.whiteTimeMs).toBe(305500);
  });

  test('timeout detection and result', () => {
    let state = initClock({ baseTimeMs: 1000, incrementMs: 0, delayMs: 0 });
    state.lastTickAt = 1000;
    
    // white moves at 3000. Elapsed: 2000ms. Time becomes 0.
    state = applyMoveToClockServer(state, { baseTimeMs: 1000, incrementMs: 0, delayMs: 0 }, 3000);
    expect(state.whiteTimeMs).toBe(0);
    expect(isTimedOut(state, 3000)).toBe('w');

    // determine timeout result with sufficient material
    // Starting position: both have sufficient material
    const res = determineTimeoutResult('w', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(res.winner).toBe('b');
    expect(res.endReason).toBe('timeout');
    
    // Black has insufficient material (only a king), White timed out -> draw
    const res2 = determineTimeoutResult('w', '8/8/8/8/8/8/8/k6K w - - 0 1');
    expect(res2.winner).toBe('draw');
    expect(res2.endReason).toBe('timeout_vs_insufficient_material');
  });

  test('getServerClockSnapshot returns correct ongoing time', () => {
    let state = initClock({ baseTimeMs: 5000, incrementMs: 0, delayMs: 0 });
    state.lastTickAt = 1000;
    // Server now is 2000. Elapsed: 1000. White time should be 4000.
    const snap = getServerClockSnapshot(state, 2000);
    expect(snap.whiteTimeMs).toBe(4000);
    expect(snap.blackTimeMs).toBe(5000);
  });
});
