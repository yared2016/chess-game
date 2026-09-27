// src/lib/chess/puzzles-data.ts
// Curated tactical puzzles database spanning multiple themes, difficulties and motifs.

export interface TacticalPuzzle {
  puzzleId: string;
  fen: string;
  initialMove?: string;
  moves: string[]; // SAN sequence: [player, opponent, player, ...]
  rating: number;
  themes: string[];
  title: string;
  description: string;
  solutionExplanation: string;
  openingFamily?: string;
  openingEco?: string;
}

export const TACTICAL_PUZZLES: TacticalPuzzle[] = [
  {
    puzzleId: "pz-001",
    title: "Back Rank Checkmate",
    fen: "6k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1",
    moves: ["Qe8#"],
    rating: 800,
    themes: ["mateIn1", "backRank"],
    description: "White to move. The enemy king is trapped behind a wall of pawns.",
    solutionExplanation: "Black's king is restricted by its own defensive pawn chain (f7, g7, h7) on the back rank. 1. Qe8# delivers an inescapable checkmate.",
    openingFamily: "Endgame",
  },
  {
    puzzleId: "pz-002",
    title: "Scholar's Trap Punishment",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
    moves: ["Qxf7#"],
    rating: 850,
    themes: ["mateIn1", "opening"],
    description: "White to move. Black left the f7 square vulnerable.",
    solutionExplanation: "The f7 pawn is defended only by the black king. White's queen and light-squared bishop coordinate to deliver immediate checkmate.",
    openingFamily: "Italian Game",
    openingEco: "C50",
  },
  {
    puzzleId: "pz-003",
    title: "Arabian Checkmate",
    fen: "7k/R5p1/5N2/8/8/8/8/6K1 w - - 0 1",
    moves: ["Ra8#"],
    rating: 900,
    themes: ["mateIn1", "arabianMate"],
    description: "White to move. The knight and rook coordinate to corner the king.",
    solutionExplanation: "The knight on f6 covers both escape squares (g8 and h7). 1. Ra8# delivers checkmate along the back rank.",
    openingFamily: "Endgame",
  },
  {
    puzzleId: "pz-004",
    title: "Dovetail Mate",
    fen: "7k/6pp/8/5Q2/8/8/8/6K1 w - - 0 1",
    moves: ["Qf8#"],
    rating: 880,
    themes: ["mateIn1", "queenCheckmate"],
    description: "White to move. Cut off the isolated king.",
    solutionExplanation: "The enemy king is trapped in the corner. 1. Qf8# seals all escape squares.",
    openingFamily: "Endgame",
  },
  {
    puzzleId: "pz-005",
    title: "Smothered Knight Strike",
    fen: "6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1",
    moves: ["Nf7#"],
    rating: 950,
    themes: ["mateIn1", "smotheredMate"],
    description: "White to move. Black's pieces surround and trap their own king.",
    solutionExplanation: "Because Black's king is entirely boxed in by its own pawns and rook, 1. Nf7# delivers a pure smothered checkmate.",
    openingFamily: "Endgame",
  },
  {
    puzzleId: "pz-006",
    title: "Royal Knight Fork",
    fen: "r3k2r/ppp2ppp/8/3N4/8/8/PPP2PPP/R3K2R w KQkq - 0 1",
    moves: ["Nxc7+", "Kd7", "Nxa8"],
    rating: 1050,
    themes: ["fork", "endgame"],
    description: "White to move. Find the geometric fork to win material.",
    solutionExplanation: "1. Nxc7+ delivers a double attack (fork) on the Black king and rook. After 1... Kd7, White safely collects the rook with 2. Nxa8.",
    openingFamily: "Four Knights Game",
    openingEco: "C47",
  },
  {
    puzzleId: "pz-007",
    title: "Anastasia's Mate",
    fen: "5rk1/4Nppp/8/7Q/8/3R4/5PPP/6K1 w - - 0 1",
    moves: ["Qxh7+", "Kxh7", "Rh3#"],
    rating: 1250,
    themes: ["mateIn2", "anastasiaMate", "sacrifice"],
    description: "White to move. A dramatic queen sacrifice cracks the fortress.",
    solutionExplanation: "1. Qxh7+! draws the king into the open on the h-file. After 1... Kxh7, the rook swings over with 2. Rh3#, supported by the knight controlling g8 and g6.",
    openingFamily: "Middlegame",
  },
  {
    puzzleId: "pz-008",
    title: "Morphy's Immortal Opera Finish",
    fen: "4kb1r/p2r1ppp/4qn2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 1",
    moves: ["Bxd7+", "Nxd7", "Qb8+", "Nxb8", "Rd8#"],
    rating: 1550,
    themes: ["mateIn3", "sacrifice", "pin"],
    description: "White to move. Paul Morphy's immortal Paris Opera masterpiece.",
    solutionExplanation: "1. Bxd7+! strips Black's defenses. After 1... Nxd7, White plays the stunning queen sacrifice 2. Qb8+!, deflecting the knight from d8 so 3. Rd8# delivers back-rank checkmate.",
    openingFamily: "Philidor Defense",
    openingEco: "C41",
  },
  {
    puzzleId: "pz-009",
    title: "Philidor's Smothered Legacy",
    fen: "5rk1/6pp/7N/8/8/8/1Q4PP/7K w - - 0 1",
    moves: ["Qb3+", "Kh8", "Qg8+", "Rxg8", "Nf7#"],
    rating: 1450,
    themes: ["mateIn3", "smotheredMate", "sacrifice"],
    description: "White to move. The classic 3-move smothered mate combination.",
    solutionExplanation: "1. Qb3+ forces 1... Kh8. Then 2. Qg8+!! forces the rook to capture 2... Rxg8, suffocating its own king so 3. Nf7# delivers smothered checkmate.",
    openingFamily: "Middlegame",
  },
  {
    puzzleId: "pz-010",
    title: "The Pinned Monarch",
    fen: "r3k2r/pppbqppp/2n5/1B6/8/8/PPPP1PPP/R1BQR1K1 w kq - 0 1",
    moves: ["Rxe7+", "Nxe7", "Bxd7+"],
    rating: 1100,
    themes: ["pin", "middlegame"],
    description: "White to move. Exploit the pinned queen along the open e-file.",
    solutionExplanation: "Black's queen is pinned against the uncastled king on the e-file. 1. Rxe7+ captures the queen directly for massive material advantage.",
    openingFamily: "Ruy Lopez",
    openingEco: "C60",
  },
  {
    puzzleId: "pz-011",
    title: "Absolute Skewer",
    fen: "4k2r/8/8/8/8/8/8/R3K3 w Qk - 0 1",
    moves: ["Ra8+", "Kf7", "Rxh8"],
    rating: 1000,
    themes: ["skewer", "endgame"],
    description: "White to move. Skewer the king to win the rook behind it.",
    solutionExplanation: "1. Ra8+ attacks the king along the 8th rank. The king is forced to move, exposing the undefended rook on h8 for 2. Rxh8.",
    openingFamily: "Endgame",
  },
  {
    puzzleId: "pz-012",
    title: "Greek Gift Discovered Check",
    fen: "r4rk1/pp2qppp/2n5/8/8/3B4/PPP2PPP/R2QR1K1 w - - 0 1",
    moves: ["Bxh7+", "Kxh7", "Rxe7"],
    rating: 1200,
    themes: ["discoveredAttack", "sacrifice"],
    description: "White to move. Use a discovered attack with check to capture the queen.",
    solutionExplanation: "1. Bxh7+ delivers check with the bishop while clearing the e-file for White's rook. After Black answers 1... Kxh7, White wins Black's queen with 2. Rxe7.",
    openingFamily: "French Defense",
    openingEco: "C00",
  },
  {
    puzzleId: "pz-013",
    title: "Pawn Breakthrough",
    fen: "8/ppp5/8/1PPP4/8/8/8/4K2k w - - 0 1",
    moves: ["b6", "axb6", "c6"],
    rating: 1650,
    themes: ["endgame", "pawnBreakthrough"],
    description: "White to move. Shatter the symmetrical pawn front to create an unstoppable passer.",
    solutionExplanation: "1. b6! sacrifices a pawn to break the pawn lock. After 1... axb6, 2. c6! forces another clearance, guaranteeing that White promotes a pawn to queen.",
    openingFamily: "Pawn Endgame",
  },
  {
    puzzleId: "pz-014",
    title: "Overloaded Defender Removal",
    fen: "6k1/5ppp/8/8/8/1q6/5PPP/1R4K1 w - - 0 1",
    moves: ["Rxb3"],
    rating: 800,
    themes: ["hangingPiece", "endgame"],
    description: "White to move. Black left their queen undefended on b3.",
    solutionExplanation: "Black moved the queen to b3 without adequate protection. 1. Rxb3 immediately captures the free queen.",
    openingFamily: "Endgame",
  },
  {
    puzzleId: "pz-015",
    title: "Cornered Bishop Trap",
    fen: "r1b1k2r/pppp1ppp/8/8/1b1q4/8/PPPBPPPP/R2QKB1R w KQkq - 0 1",
    moves: ["c3", "Qe5", "cxb4"],
    rating: 1150,
    themes: ["fork", "opening"],
    description: "White to move. Push the pawn with tempo to trap the active bishop.",
    solutionExplanation: "1. c3! creates a double attack on Black's queen and bishop on b4. Black must retreat the queen, allowing White to capture the bishop on the next turn.",
    openingFamily: "Scandinavian Defense",
    openingEco: "B01",
  },
  {
    puzzleId: "pz-016",
    title: "Double Rook Escalator Mate",
    fen: "5k2/8/8/8/8/8/1R6/2R1K3 w - - 0 1",
    moves: ["Rb7", "Kg8", "Rc8#"],
    rating: 950,
    themes: ["mateIn2", "lawnmowerMate", "endgame"],
    description: "White to move. Use two rooks to roll the king to the edge.",
    solutionExplanation: "1. Rb7 cuts off the 7th rank. After Black's only legal move 1... Kg8, 2. Rc8# seals the 8th rank for the classic escalator checkmate.",
    openingFamily: "Endgame",
  },
  {
    puzzleId: "pz-017",
    title: "Queen & Knight Coordination",
    fen: "r4rk1/1pp2ppp/p7/4N3/2B5/7Q/PPP2PPP/R4RK1 w - - 0 1",
    moves: ["Bxf7+", "Rxf7", "Nxf7"],
    rating: 1100,
    themes: ["sacrifice", "middlegame"],
    description: "White to move. Target the f7 square to break through.",
    solutionExplanation: "1. Bxf7+ sacrifices the bishop to dislodge Black's rook guard. After 1... Rxf7, 2. Nxf7 wins the exchange and exposes the king.",
    openingFamily: "Ruy Lopez",
    openingEco: "C60",
  },
  {
    puzzleId: "pz-018",
    title: "Back Rank Deflection",
    fen: "3r2k1/p4ppp/8/8/8/8/4QPPP/3R2K1 w - - 0 1",
    moves: ["Rxd8#"],
    rating: 850,
    themes: ["mateIn1", "backRank"],
    description: "White to move. Strike the back rank directly.",
    solutionExplanation: "Black's rook on d8 was insufficiently guarded. 1. Rxd8# captures the rook and delivers back-rank checkmate in one stroke.",
    openingFamily: "Endgame",
  },
];

/**
 * Returns a daily puzzle deterministically computed from the current date string (YYYY-MM-DD).
 */
export function getDailyPuzzle(date: Date = new Date()): TacticalPuzzle {
  const dateStr = date.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TACTICAL_PUZZLES.length;
  return TACTICAL_PUZZLES[index];
}

/**
 * Returns a random puzzle, optionally filtered by theme or rating range.
 */
export function getFilteredPuzzles(filter?: {
  theme?: string;
  minRating?: number;
  maxRating?: number;
}): TacticalPuzzle[] {
  return TACTICAL_PUZZLES.filter((p) => {
    if (filter?.theme && filter.theme !== "all" && !p.themes.includes(filter.theme)) {
      return false;
    }
    if (filter?.minRating && p.rating < filter.minRating) return false;
    if (filter?.maxRating && p.rating > filter.maxRating) return false;
    return true;
  });
}
