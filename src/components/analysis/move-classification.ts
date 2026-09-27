// src/components/analysis/move-classification.ts
// Standard chess move classification engine based on centipawn loss and engine evaluations.

export type MoveQuality =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "book";

export interface MoveClassification {
  quality: MoveQuality;
  badge: string;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
}

export const MOVE_CLASSIFICATIONS: Record<MoveQuality, MoveClassification> = {
  brilliant: {
    quality: "brilliant",
    badge: "!!",
    label: "Brilliant",
    colorClass: "text-teal-400",
    bgClass: "bg-teal-500/10",
    borderClass: "border-teal-500/30",
    description: "An extraordinary move that sacrifices material to gain a decisive advantage.",
  },
  great: {
    quality: "great",
    badge: "!",
    label: "Great Move",
    colorClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/30",
    description: "A difficult, high-impact move that found the single best continuation.",
  },
  best: {
    quality: "best",
    badge: "★",
    label: "Best Move",
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    description: "The engine's top choice in this position.",
  },
  excellent: {
    quality: "excellent",
    badge: "✓",
    label: "Excellent",
    colorClass: "text-green-400",
    bgClass: "bg-green-500/10",
    borderClass: "border-green-500/30",
    description: "Nearly as good as the best move, keeping the advantage.",
  },
  good: {
    quality: "good",
    badge: "•",
    label: "Good",
    colorClass: "text-zinc-300",
    bgClass: "bg-zinc-500/10",
    borderClass: "border-zinc-500/30",
    description: "A solid, playable move.",
  },
  inaccuracy: {
    quality: "inaccuracy",
    badge: "?!",
    label: "Inaccuracy",
    colorClass: "text-yellow-400",
    bgClass: "bg-yellow-500/10",
    borderClass: "border-yellow-500/30",
    description: "Suboptimal move that gives the opponent slight counterplay.",
  },
  mistake: {
    quality: "mistake",
    badge: "?",
    label: "Mistake",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/30",
    description: "A clear mistake that significantly weakens the position.",
  },
  blunder: {
    quality: "blunder",
    badge: "??",
    label: "Blunder",
    colorClass: "text-red-400",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/30",
    description: "A major error that drastically shifts the evaluation or loses material.",
  },
  book: {
    quality: "book",
    badge: "📖",
    label: "Book Move",
    colorClass: "text-purple-400",
    bgClass: "bg-purple-500/10",
    borderClass: "border-purple-500/30",
    description: "Standard opening book theory.",
  },
};

/**
 * Classifies a move based on centipawn loss from the player's perspective.
 *
 * @param playedMoveSan The move played by the user
 * @param bestMoveSan The engine's top choice
 * @param prevScoreCp Evaluation before the move from White's POV
 * @param newScoreCp Evaluation after the move from White's POV
 * @param moverColour 'w' or 'b'
 * @param isSacrifice Whether the move sacrificed piece material
 */
export function classifyMove(
  playedMoveSan: string,
  bestMoveSan: string | null,
  prevScoreCp: number | null,
  newScoreCp: number | null,
  moverColour: "w" | "b",
  isSacrifice = false
): MoveClassification {
  // If move matches engine top choice
  if (bestMoveSan && playedMoveSan.toLowerCase() === bestMoveSan.toLowerCase()) {
    if (isSacrifice && (moverColour === "w" ? (newScoreCp ?? 0) >= 0 : (newScoreCp ?? 0) <= 0)) {
      return MOVE_CLASSIFICATIONS.brilliant;
    }
    return MOVE_CLASSIFICATIONS.best;
  }

  // If we don't have evaluation numbers, default to good
  if (prevScoreCp === null || newScoreCp === null) {
    return MOVE_CLASSIFICATIONS.good;
  }

  // Compute centipawn change from the mover's point of view
  // Higher = better for mover
  const prevAdvantage = moverColour === "w" ? prevScoreCp : -prevScoreCp;
  const newAdvantage = moverColour === "w" ? newScoreCp : -newScoreCp;
  const cpLoss = Math.max(0, prevAdvantage - newAdvantage);

  if (cpLoss <= 15) {
    return MOVE_CLASSIFICATIONS.excellent;
  }
  if (cpLoss <= 45) {
    return MOVE_CLASSIFICATIONS.good;
  }
  if (cpLoss <= 110) {
    return MOVE_CLASSIFICATIONS.inaccuracy;
  }
  if (cpLoss <= 250) {
    return MOVE_CLASSIFICATIONS.mistake;
  }
  return MOVE_CLASSIFICATIONS.blunder;
}
