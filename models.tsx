export interface LichessPuzzle {
  id: string;
  moves: string[];
  fen: string;
  popularity: number;
  tags: string[];
  gameLink: string;
  rating: number;
  ratingDeviation: number;
  numberPlays: number;
  allMoves: string[];
  maxPly: number;
}

export interface RepertoireMove {
  id: string;
  fen: string;
  sanPlus: string;
  mine: boolean;
  incidence?: number;
  fenAfter: string;
}

export interface Repertoire {
  expectedDepth: number;
  moves: RepertoireMove[];
}

export interface BlunderPuzzle {
  id: string;
  fen: string;
  bestMove: string;
  blunder: string;
  centipawnsLost: number;
}

export interface User {
  // paid?: string;
  email: string;
  // subscription: ApplicationSubscription;
  apiKey: string;
}

export interface LichessGame {
  id: String;
  gameLink: String;
  result: number; // GameResult
  moves: string[];
  blackCentipawnLoss: number;
  whiteCentipawnLoss: number;
  numberMoves: number;
  whiteElo: number;
  blackElo: number;
  time: number;
  whiteBlunders: number;
  blackBlunders: number;
  whiteMistakes: number;
  blackMistakes: number;
}