// src/lib/chess/openings.ts
// Standard ECO (Encyclopedia of Chess Openings) database and fast prefix recognition engine.

export interface OpeningDefinition {
  eco: string;
  name: string;
  variation?: string;
  moves: string[]; // Sequence of SAN moves
}

export interface OpeningMatch {
  eco: string;
  name: string;
  variation?: string;
  fullName: string;
  plyCount: number;
}

export const OPENINGS: OpeningDefinition[] = [
  // ==========================================
  // A: Flank Openings & Unusual Openings
  // ==========================================
  { eco: "A00", name: "Polish Opening", moves: ["b4"] },
  { eco: "A00", name: "Grob Opening", moves: ["g4"] },
  { eco: "A00", name: "Hungarian Opening", moves: ["g3"] },
  { eco: "A01", name: "Nimzo-Larsen Attack", moves: ["b3"] },
  { eco: "A02", name: "Bird's Opening", moves: ["f4"] },
  { eco: "A03", name: "Bird's Opening", variation: "From's Gambit", moves: ["f4", "e5"] },
  { eco: "A04", name: "Réti Opening", moves: ["Nf3"] },
  { eco: "A05", name: "Réti Opening", variation: "King's Indian Attack", moves: ["Nf3", "Nf6", "g3"] },
  { eco: "A06", name: "Réti Opening", variation: "Old Indian Attack", moves: ["Nf3", "d5", "g3"] },
  { eco: "A07", name: "King's Indian Attack", variation: "Yugoslav Variation", moves: ["Nf3", "d5", "g3", "Nf6", "Bg2", "c6", "O-O", "Bg4"] },
  { eco: "A09", name: "Réti Opening", variation: "Réti Gambit", moves: ["Nf3", "d5", "c4"] },
  { eco: "A10", name: "English Opening", moves: ["c4"] },
  { eco: "A13", name: "English Opening", variation: "Agincourt Defense", moves: ["c4", "e6"] },
  { eco: "A15", name: "English Opening", variation: "Anglo-Indian Defense", moves: ["c4", "Nf6"] },
  { eco: "A20", name: "English Opening", variation: "King's English Variation", moves: ["c4", "e5"] },
  { eco: "A22", name: "English Opening", variation: "Two Knights", moves: ["c4", "e5", "Nc3", "Nf6"] },
  { eco: "A28", name: "English Opening", variation: "Four Knights", moves: ["c4", "e5", "Nc3", "Nf6", "Nf3", "Nc6"] },
  { eco: "A30", name: "English Opening", variation: "Symmetrical Variation", moves: ["c4", "c5"] },
  { eco: "A40", name: "Queen's Pawn Opening", moves: ["d4"] },
  { eco: "A45", name: "Trompowsky Attack", moves: ["d4", "Nf6", "Bg5"] },
  { eco: "A46", name: "Torre Attack", moves: ["d4", "Nf6", "Nf3", "e6", "Bg5"] },
  { eco: "A48", name: "East Indian Defense", moves: ["d4", "Nf6", "Nf3", "g6"] },
  { eco: "A51", name: "Budapest Gambit", moves: ["d4", "Nf6", "c4", "e5"] },
  { eco: "A52", name: "Budapest Gambit", variation: "Adler Variation", moves: ["d4", "Nf6", "c4", "e5", "dxe5", "Ng4", "Nf3"] },
  { eco: "A57", name: "Benko Gambit", moves: ["d4", "Nf6", "c4", "c5", "d5", "b5"] },
  { eco: "A60", name: "Modern Benoni", moves: ["d4", "Nf6", "c4", "c5", "d5", "e6"] },
  { eco: "A80", name: "Dutch Defense", moves: ["d4", "f5"] },
  { eco: "A85", name: "Dutch Defense", variation: "Queen's Knight Variation", moves: ["d4", "f5", "c4", "Nf6", "Nc3"] },
  { eco: "A87", name: "Dutch Defense", variation: "Leningrad Variation", moves: ["d4", "f5", "c4", "Nf6", "g3", "g6", "Bg2", "Bg7", "Nf3", "O-O"] },
  { eco: "A90", name: "Dutch Defense", variation: "Stonewall Variation", moves: ["d4", "f5", "c4", "Nf6", "g3", "e6", "Bg2", "c6", "Nf3", "d5"] },

  // ==========================================
  // B: Semi-Open Games (excluding French)
  // ==========================================
  { eco: "B00", name: "King's Pawn Opening", moves: ["e4"] },
  { eco: "B01", name: "Scandinavian Defense", moves: ["e4", "d5"] },
  { eco: "B01", name: "Scandinavian Defense", variation: "Mieses-Kotrč Variation", moves: ["e4", "d5", "exd5", "Qxd5"] },
  { eco: "B01", name: "Scandinavian Defense", variation: "Modern Variation", moves: ["e4", "d5", "exd5", "Nf6"] },
  { eco: "B02", name: "Alekhine's Defense", moves: ["e4", "Nf6"] },
  { eco: "B03", name: "Alekhine's Defense", variation: "Four Pawns Attack", moves: ["e4", "Nf6", "e5", "Nd5", "d4", "d6", "c4", "Nb6", "f4"] },
  { eco: "B07", name: "Pirc Defense", moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"] },
  { eco: "B08", name: "Pirc Defense", variation: "Classical Variation", moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "Nf3", "Bg7", "Be2", "O-O"] },
  { eco: "B09", name: "Pirc Defense", variation: "Austrian Attack", moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "f4"] },
  { eco: "B10", name: "Caro-Kann Defense", moves: ["e4", "c6"] },
  { eco: "B12", name: "Caro-Kann Defense", variation: "Advance Variation", moves: ["e4", "c6", "d4", "d5", "e5"] },
  { eco: "B13", name: "Caro-Kann Defense", variation: "Exchange Variation", moves: ["e4", "c6", "d4", "d5", "exd5", "cxd5"] },
  { eco: "B14", name: "Caro-Kann Defense", variation: "Panov-Botvinnik Attack", moves: ["e4", "c6", "d4", "d5", "exd5", "cxd5", "c4"] },
  { eco: "B15", name: "Caro-Kann Defense", variation: "Tartakower Variation", moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Nf6", "Nxf6+", "exf6"] },
  { eco: "B18", name: "Caro-Kann Defense", variation: "Classical Variation", moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"] },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5"] },
  { eco: "B21", name: "Sicilian Defense", variation: "Grand Prix Attack", moves: ["e4", "c5", "f4"] },
  { eco: "B21", name: "Sicilian Defense", variation: "Smith-Morra Gambit", moves: ["e4", "c5", "d4", "cxd4", "c3"] },
  { eco: "B22", name: "Sicilian Defense", variation: "Alapin Variation", moves: ["e4", "c5", "c3"] },
  { eco: "B23", name: "Sicilian Defense", variation: "Closed", moves: ["e4", "c5", "Nc3"] },
  { eco: "B27", name: "Sicilian Defense", variation: "Open", moves: ["e4", "c5", "Nf3"] },
  { eco: "B30", name: "Sicilian Defense", variation: "Nezhmetdinov-Rossolimo Attack", moves: ["e4", "c5", "Nf3", "Nc6", "Bb5"] },
  { eco: "B32", name: "Sicilian Defense", variation: "Open Classical", moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4"] },
  { eco: "B33", name: "Sicilian Defense", variation: "Sveshnikov Variation", moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"] },
  { eco: "B34", name: "Sicilian Defense", variation: "Accelerated Dragon", moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "g6"] },
  { eco: "B40", name: "Sicilian Defense", variation: "French Variation", moves: ["e4", "c5", "Nf3", "e6"] },
  { eco: "B41", name: "Sicilian Defense", variation: "Kan Variation", moves: ["e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "a6"] },
  { eco: "B45", name: "Sicilian Defense", variation: "Taimanov Variation", moves: ["e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "Nc6", "Nc3"] },
  { eco: "B50", name: "Sicilian Defense", variation: "Modern", moves: ["e4", "c5", "Nf3", "d6"] },
  { eco: "B52", name: "Sicilian Defense", variation: "Canal-Sokolsky Attack", moves: ["e4", "c5", "Nf3", "d6", "Bb5+"] },
  { eco: "B70", name: "Sicilian Defense", variation: "Dragon Variation", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"] },
  { eco: "B75", name: "Sicilian Defense", variation: "Yugoslav Attack", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6", "Be3", "Bg7", "f3"] },
  { eco: "B80", name: "Sicilian Defense", variation: "Scheveningen Variation", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"] },
  { eco: "B90", name: "Sicilian Defense", variation: "Najdorf Variation", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },

  // ==========================================
  // C: Open Games & French Defense
  // ==========================================
  { eco: "C00", name: "French Defense", moves: ["e4", "e6"] },
  { eco: "C01", name: "French Defense", variation: "Exchange Variation", moves: ["e4", "e6", "d4", "d5", "exd5", "exd5"] },
  { eco: "C02", name: "French Defense", variation: "Advance Variation", moves: ["e4", "e6", "d4", "d5", "e5"] },
  { eco: "C03", name: "French Defense", variation: "Tarrasch Variation", moves: ["e4", "e6", "d4", "d5", "Nd2"] },
  { eco: "C10", name: "French Defense", variation: "Paulsen Variation", moves: ["e4", "e6", "d4", "d5", "Nc3"] },
  { eco: "C11", name: "French Defense", variation: "Classical Variation", moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] },
  { eco: "C15", name: "French Defense", variation: "Winawer Variation", moves: ["e4", "e6", "d4", "d5", "Nc3", "Bb4"] },
  { eco: "C20", name: "King's Pawn Game", moves: ["e4", "e5"] },
  { eco: "C21", name: "Center Game", moves: ["e4", "e5", "d4", "exd4", "Qxd4"] },
  { eco: "C21", name: "Danish Gambit", moves: ["e4", "e5", "d4", "exd4", "c3"] },
  { eco: "C23", name: "Bishop's Opening", moves: ["e4", "e5", "Bc4"] },
  { eco: "C25", name: "Vienna Game", moves: ["e4", "e5", "Nc3"] },
  { eco: "C26", name: "Vienna Game", variation: "Falkbeer Variation", moves: ["e4", "e5", "Nc3", "Nf6"] },
  { eco: "C29", name: "Vienna Gambit", moves: ["e4", "e5", "Nc3", "Nf6", "f4"] },
  { eco: "C30", name: "King's Gambit", moves: ["e4", "e5", "f4"] },
  { eco: "C33", name: "King's Gambit Accepted", moves: ["e4", "e5", "f4", "exf4"] },
  { eco: "C40", name: "King's Knight Opening", moves: ["e4", "e5", "Nf3"] },
  { eco: "C41", name: "Philidor Defense", moves: ["e4", "e5", "Nf3", "d6"] },
  { eco: "C42", name: "Petrov's Defense", moves: ["e4", "e5", "Nf3", "Nf6"] },
  { eco: "C44", name: "Scotch Game", moves: ["e4", "e5", "Nf3", "Nc6", "d4"] },
  { eco: "C45", name: "Scotch Game", variation: "Mieses Variation", moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6", "Nxc6", "bxc6", "e5"] },
  { eco: "C46", name: "Three Knights Opening", moves: ["e4", "e5", "Nf3", "Nc6", "Nc3"] },
  { eco: "C47", name: "Four Knights Game", moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"] },
  { eco: "C48", name: "Four Knights Game", variation: "Spanish Variation", moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6", "Bb5"] },
  { eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { eco: "C50", name: "Italian Game", variation: "Giuoco Pianissimo", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "d3"] },
  { eco: "C51", name: "Evans Gambit", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"] },
  { eco: "C53", name: "Italian Game", variation: "Giuoco Piano", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3"] },
  { eco: "C55", name: "Italian Game", variation: "Two Knights Defense", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"] },
  { eco: "C57", name: "Italian Game", variation: "Fried Liver Attack", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5", "Nxf7"] },
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { eco: "C65", name: "Ruy Lopez", variation: "Berlin Defense", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
  { eco: "C67", name: "Ruy Lopez", variation: "Berlin Defense (Open)", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O", "Nxe4"] },
  { eco: "C68", name: "Ruy Lopez", variation: "Exchange Variation", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6"] },
  { eco: "C70", name: "Ruy Lopez", variation: "Morphy Defense", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4"] },
  { eco: "C80", name: "Ruy Lopez", variation: "Open Variation", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Nxe4"] },
  { eco: "C84", name: "Ruy Lopez", variation: "Closed Variation", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"] },
  { eco: "C89", name: "Ruy Lopez", variation: "Marshall Attack", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "O-O", "c3", "d5"] },

  // ==========================================
  // D: Closed Games & Semi-Closed Games
  // ==========================================
  { eco: "D00", name: "Queen's Pawn Game", moves: ["d4", "d5"] },
  { eco: "D00", name: "London System", moves: ["d4", "d5", "Bf4"] },
  { eco: "D02", name: "London System", variation: "Classical", moves: ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
  { eco: "D04", name: "Colle System", moves: ["d4", "d5", "Nf3", "Nf6", "e3"] },
  { eco: "D06", name: "Queen's Gambit", moves: ["d4", "d5", "c4"] },
  { eco: "D07", name: "Chigorin Defense", moves: ["d4", "d5", "c4", "Nc6"] },
  { eco: "D08", name: "Albin Counter-Gambit", moves: ["d4", "d5", "c4", "e5"] },
  { eco: "D10", name: "Slav Defense", moves: ["d4", "d5", "c4", "c6"] },
  { eco: "D11", name: "Slav Defense", variation: "Modern Line", moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6"] },
  { eco: "D15", name: "Slav Defense", variation: "Three Knights", moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3"] },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: ["d4", "d5", "c4", "dxc4"] },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"] },
  { eco: "D31", name: "Semi-Slav Defense", moves: ["d4", "d5", "c4", "e6", "Nc3", "c6"] },
  { eco: "D35", name: "Queen's Gambit Declined", variation: "Exchange Variation", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5"] },
  { eco: "D43", name: "Semi-Slav Defense", variation: "Main Line", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Nf3", "c6"] },
  { eco: "D45", name: "Semi-Slav Defense", variation: "Meran Variation", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Nf3", "c6", "e3", "Nbd7", "Bd3", "dxc4", "Bxc4", "b5"] },
  { eco: "D50", name: "Queen's Gambit Declined", variation: "Hastings Attack", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5"] },
  { eco: "D55", name: "Queen's Gambit Declined", variation: "Orthodox Defense", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3"] },
  { eco: "D80", name: "Grünfeld Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"] },
  { eco: "D85", name: "Grünfeld Defense", variation: "Exchange Variation", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5", "cxd5", "Nxd5", "e4", "Nxc3", "bxc3"] },

  // ==========================================
  // E: Indian Defenses
  // ==========================================
  { eco: "E00", name: "Catalan Opening", moves: ["d4", "Nf6", "c4", "e6", "g3"] },
  { eco: "E04", name: "Catalan Opening", variation: "Open Variation", moves: ["d4", "Nf6", "c4", "e6", "g3", "d5", "Bg2", "dxc4"] },
  { eco: "E11", name: "Bogo-Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "Bb4+"] },
  { eco: "E12", name: "Queen's Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
  { eco: "E20", name: "Nimzo-Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { eco: "E32", name: "Nimzo-Indian Defense", variation: "Classical Variation", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "Qc2"] },
  { eco: "E40", name: "Nimzo-Indian Defense", variation: "Rubinstein System", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3"] },
  { eco: "E60", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6"] },
  { eco: "E61", name: "King's Indian Defense", variation: "Standard", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"] },
  { eco: "E70", name: "King's Indian Defense", variation: "Four Pawns Attack", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f4"] },
  { eco: "E80", name: "King's Indian Defense", variation: "Sämisch Variation", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f3"] },
  { eco: "E90", name: "King's Indian Defense", variation: "Classical Variation", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2", "e5"] },
  { eco: "E97", name: "King's Indian Defense", variation: "Mar del Plata Variation", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2", "e5", "O-O", "Nc6", "d5", "Ne7"] },
];

/**
 * Normalizes a SAN move sequence to ensure standard case and punctuation.
 */
function cleanMove(move: string): string {
  return move.replace(/[+#?!]/g, "").trim();
}

/**
 * Matches an ongoing or finished move list against standard chess openings.
 * Returns the deepest matching opening definition.
 *
 * @param moves List of moves played (either array of SAN strings or space-separated SAN string)
 */
export function detectOpening(moves: string[] | string): OpeningMatch | null {
  const moveList: string[] = Array.isArray(moves)
    ? moves
    : moves
        .replace(/\d+\./g, "")
        .trim()
        .split(/\s+/)
        .filter((m) => m.length > 0);

  if (moveList.length === 0) return null;

  const cleanedPlayed = moveList.map(cleanMove);

  let bestMatch: OpeningDefinition | null = null;
  let maxMatchedPlies = 0;

  for (const opening of OPENINGS) {
    if (opening.moves.length > cleanedPlayed.length) continue;

    let matches = true;
    for (let i = 0; i < opening.moves.length; i++) {
      if (cleanMove(opening.moves[i]) !== cleanedPlayed[i]) {
        matches = false;
        break;
      }
    }

    if (matches && opening.moves.length > maxMatchedPlies) {
      bestMatch = opening;
      maxMatchedPlies = opening.moves.length;
    }
  }

  if (!bestMatch) return null;

  const fullName = bestMatch.variation
    ? `${bestMatch.name}: ${bestMatch.variation}`
    : bestMatch.name;

  return {
    eco: bestMatch.eco,
    name: bestMatch.name,
    variation: bestMatch.variation,
    fullName,
    plyCount: maxMatchedPlies,
  };
}
