import { Chess } from 'chess.js';

export interface ClockState {
  whiteTimeMs: number;
  blackTimeMs: number;
  activeColor: 'w' | 'b';
  lastTickAt: number;
  moveCount: number;
  clockVersion: number;
}

export interface ClockConfig {
  baseTimeMs: number;
  incrementMs: number;
  delayMs: number;
}

export function initClock(config: ClockConfig): ClockState {
  return {
    whiteTimeMs: config.baseTimeMs,
    blackTimeMs: config.baseTimeMs,
    activeColor: 'w',
    lastTickAt: 0, // Should be set correctly on first move or game start
    moveCount: 0,
    clockVersion: 0,
  };
}

export function applyMoveToClockServer(state: ClockState, config: ClockConfig, serverNow: number): ClockState {
  const elapsed = serverNow - state.lastTickAt;
  const effectiveElapsed = Math.max(0, elapsed - config.delayMs);
  
  let newWhiteTime = state.whiteTimeMs;
  let newBlackTime = state.blackTimeMs;
  
  if (state.activeColor === 'w') {
    newWhiteTime -= effectiveElapsed;
    if (newWhiteTime <= 0) {
      return { ...state, whiteTimeMs: 0, lastTickAt: serverNow, clockVersion: state.clockVersion + 1 };
    }
    newWhiteTime += config.incrementMs;
  } else {
    newBlackTime -= effectiveElapsed;
    if (newBlackTime <= 0) {
      return { ...state, blackTimeMs: 0, lastTickAt: serverNow, clockVersion: state.clockVersion + 1 };
    }
    newBlackTime += config.incrementMs;
  }
  
  return {
    whiteTimeMs: newWhiteTime,
    blackTimeMs: newBlackTime,
    activeColor: state.activeColor === 'w' ? 'b' : 'w',
    lastTickAt: serverNow,
    moveCount: state.moveCount + 1,
    clockVersion: state.clockVersion + 1
  };
}

export function getServerClockSnapshot(state: ClockState, serverNow: number): { whiteTimeMs: number, blackTimeMs: number } {
  if (state.lastTickAt === 0) {
    return { whiteTimeMs: state.whiteTimeMs, blackTimeMs: state.blackTimeMs };
  }

  const elapsed = serverNow - state.lastTickAt;
  // Delay only applies if we're not actually updating the clock permanently yet, but we'll assume a snapshot
  // is just what the clock looks like *right now*.
  // Technically Bronstein delay means the clock visually doesn't move until delay is up.
  // We'll return the projected time.
  // But wait, the spec doesn't require delay for the snapshot, but we can do it:
  
  // Actually, we don't need to know the config.delayMs for a simple snapshot if it's not provided,
  // but let's assume delayMs is 0 for the basic snapshot.
  const timeToDeduct = elapsed; 
  
  if (state.activeColor === 'w') {
    return {
      whiteTimeMs: Math.max(0, state.whiteTimeMs - timeToDeduct),
      blackTimeMs: state.blackTimeMs
    };
  } else {
    return {
      whiteTimeMs: state.whiteTimeMs,
      blackTimeMs: Math.max(0, state.blackTimeMs - timeToDeduct)
    };
  }
}

export function isTimedOut(state: ClockState, serverNow: number): 'w' | 'b' | null {
  const snapshot = getServerClockSnapshot(state, serverNow);
  if (snapshot.whiteTimeMs <= 0) return 'w';
  if (snapshot.blackTimeMs <= 0) return 'b';
  return null;
}

export function determineTimeoutResult(timedOutColor: 'w' | 'b', fen: string): { winner: 'w' | 'b' | 'draw', endReason: string } {
  const chess = new Chess(fen);
  
  // The person who didn't time out is the winner, UNLESS they lack sufficient material
  const winnerColor = timedOutColor === 'w' ? 'b' : 'w';
  
  // We check if the winning color has sufficient mating material
  // chess.js doesn't have a direct "hasInsufficientMaterial(color)" function,
  // but we can check if the position is a draw due to insufficient material if the other side timed out.
  // Wait, insufficient material is evaluated generally. We can manually check:
  // A side has sufficient material if they have a Queen, Rook, Pawn, or (2 Bishops, or Bishop+Knight - simplistic).
  
  // Simplest: check board.
  const board = chess.board();
  let hasPawn = false;
  let hasRook = false;
  let hasQueen = false;
  let bishops = 0;
  let knights = 0;
  
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.color === winnerColor) {
        if (piece.type === 'p') hasPawn = true;
        if (piece.type === 'r') hasRook = true;
        if (piece.type === 'q') hasQueen = true;
        if (piece.type === 'b') bishops++;
        if (piece.type === 'n') knights++;
      }
    }
  }
  
  const hasSufficientMaterial = hasPawn || hasRook || hasQueen || (bishops >= 2) || (bishops >= 1 && knights >= 1);
  
  if (!hasSufficientMaterial) {
    return { winner: 'draw', endReason: 'timeout_vs_insufficient_material' };
  }
  
  return { winner: winnerColor, endReason: 'timeout' };
}
