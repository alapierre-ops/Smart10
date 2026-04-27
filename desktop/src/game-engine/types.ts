export type TfAnswer = "true" | "false";
export type QuestionType = "true_false" | "ranking" | "binary_choice" | "free_text";

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface TfQuestion {
  id: string;
  prompt: string;
  correctAnswer: TfAnswer;
  category?: string;
}

export interface QuestionProposition {
  id: string;
  text: string;
  correctAnswer: string;
}

export interface QuestionCard {
  id: string;
  title: string;
  type: QuestionType;
  binaryChoices?: [string, string];
  propositions: QuestionProposition[];
}

export interface RoundState {
  questionId: string;
  currentPlayerIndex: number;
  attemptedByPlayerIds: string[];
  resolved: boolean;
}

export interface GameState {
  status: "setup" | "in_round" | "round_summary" | "finished";
  players: Player[];
  questions: TfQuestion[];
  pointsPerCorrect: number;
  usedQuestionIds: string[];
  round: number;
  maxRounds: number;
  activeRound: RoundState | null;
  winnerIds: string[];
}
