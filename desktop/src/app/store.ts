import { create } from "zustand";
import { QuestionCard, QuestionType } from "../game-engine/types";
import { createCard, exportCards, importCardsFromJson, loadCards, saveCards } from "../storage/questionPacks";

type MatchPlayerStatus = "active" | "stopped" | "eliminated";
type MatchPhase = "in_round" | "round_summary" | "finished";
const PATHS_STORAGE_KEY = "smart10.paths";

interface MatchPlayer {
  id: string;
  name: string;
  totalScore: number;
  tempScore: number;
  status: MatchPlayerStatus;
}

interface MatchState {
  phase: MatchPhase;
  targetPointsToWin: number;
  orderedCards: QuestionCard[];
  currentCardIndex: number;
  currentPlayerId: string;
  players: MatchPlayer[];
  revealedPropositionIds: string[];
  selectedPropositionId: string | null;
  decisionPendingPlayerId: string | null;
  wrongAnswerFeedback: { message: string; nextPlayerId: string | null } | null;
  pendingFreeTextValidation: {
    propositionId: string;
    submittedAnswer: string;
    expectedAnswer: string;
  } | null;
  winnerIds: string[];
}

export interface SavedPath {
  id: string;
  name: string;
  category: string;
  cardIds: string[];
}

interface AppState {
  cards: QuestionCard[];
  savedPaths: SavedPath[];
  matchState: MatchState | null;
  setupPlayers: string[];
  targetPointsToWin: number;
  selectedCardIdsForMatch: string[];
  setPlayerName: (index: number, name: string) => void;
  addPlayer: () => void;
  removePlayer: (index: number) => void;
  setTargetPointsToWin: (points: number) => void;
  addCardToMatchSelection: (cardId: string) => void;
  removeCardFromMatchSelection: (cardId: string) => void;
  moveSelectedCardInMatch: (cardId: string, direction: "up" | "down") => void;
  setCardSelectionForMatch: (cardIds: string[]) => void;
  createPathFromSelection: (name: string, category: string) => string | null;
  updatePathFromSelection: (pathId: string, name: string, category: string) => string | null;
  deletePath: (pathId: string) => void;
  startMatch: () => string | null;
  selectProposition: (propositionId: string) => void;
  answerSelectedProposition: (answer: string) => void;
  validateFreeTextAsCorrect: () => void;
  validateFreeTextAsWrong: () => void;
  secureAndStopTurn: () => void;
  riskAndContinueTurn: () => void;
  acknowledgeWrongAnswerFeedback: () => void;
  continueAfterRound: () => void;
  terminateMatch: () => void;
  addCard: (
    title: string,
    type: QuestionType,
    propositions: { text: string; correctAnswer: string }[],
    binaryChoices?: [string, string]
  ) => string | null;
  updateCard: (
    cardId: string,
    title: string,
    type: QuestionType,
    propositions: { text: string; correctAnswer: string }[],
    binaryChoices?: [string, string]
  ) => string | null;
  deleteCard: (cardId: string) => void;
  exportCards: (subset?: QuestionCard[]) => string;
  importCards: (raw: string) => boolean;
}

const cards = loadCards();
const cloneImportedCardWithNewIds = (card: QuestionCard): QuestionCard => ({
  ...card,
  id: `card_${crypto.randomUUID()}`,
  propositions: card.propositions.map((proposition) => ({
    ...proposition,
    id: `prop_${crypto.randomUUID()}`
  }))
});
const createDefaultPaths = (availableCards: QuestionCard[]): SavedPath[] => {
  const ids = availableCards.map((card) => card.id);
  const pick = (start: number, count: number): string[] => ids.slice(start, start + count);
  const defaults: SavedPath[] = [
    {
      id: "path_default_geo",
      name: "Tour du monde",
      category: "Géographie",
      cardIds: pick(0, 5)
    },
    {
      id: "path_default_culture",
      name: "Culture pop",
      category: "Culture générale",
      cardIds: pick(3, 5)
    },
    {
      id: "path_default_mix",
      name: "Mix rapide",
      category: "Mix",
      cardIds: pick(6, 5)
    }
  ];
  return defaults.filter((path) => path.cardIds.length > 0);
};
const loadPaths = (availableCards: QuestionCard[]): SavedPath[] => {
  const defaults = createDefaultPaths(availableCards);
  const raw = localStorage.getItem(PATHS_STORAGE_KEY);
  if (!raw) {
    savePaths(defaults);
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw) as SavedPath[];
    if (!Array.isArray(parsed)) {
      savePaths(defaults);
      return defaults;
    }
    const valid = parsed.filter(
      (path) =>
        Boolean(path?.id?.trim()) &&
        Boolean(path?.name?.trim()) &&
        Boolean(path?.category?.trim()) &&
        Array.isArray(path.cardIds)
    );
    const merged = [...valid];
    defaults.forEach((defaultPath) => {
      if (!merged.some((path) => path.id === defaultPath.id)) {
        merged.push(defaultPath);
      }
    });
    if (merged.length === 0) {
      savePaths(defaults);
      return defaults;
    }
    if (merged.length !== valid.length) {
      savePaths(merged);
    }
    return merged;
  } catch (_error) {
    savePaths(defaults);
    return defaults;
  }
};
const savePaths = (paths: SavedPath[]): void => {
  localStorage.setItem(PATHS_STORAGE_KEY, JSON.stringify(paths));
};
const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

const getCurrentCard = (state: MatchState): QuestionCard => state.orderedCards[state.currentCardIndex];
const isAnswerCorrect = (cardType: QuestionType, expected: string, received: string): boolean => {
  if (cardType === "free_text") {
    return normalizeText(expected) === normalizeText(received);
  }
  return expected === received;
};

const getActivePlayers = (state: MatchState): MatchPlayer[] => state.players.filter((player) => player.status === "active");

const getNextActivePlayerId = (state: MatchState, fromPlayerId: string): string | null => {
  const fromIndex = state.players.findIndex((player) => player.id === fromPlayerId);
  if (fromIndex < 0) {
    return null;
  }
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = state.players[(fromIndex + offset) % state.players.length];
    if (candidate.status === "active") {
      return candidate.id;
    }
  }
  return null;
};

const finishMatchIfNeeded = (state: MatchState): MatchState => {
  const reachedTarget = state.players.some((player) => player.totalScore + player.tempScore >= state.targetPointsToWin);
  const outOfCards = state.currentCardIndex >= state.orderedCards.length - 1;
  if (!reachedTarget && !outOfCards) {
    return { ...state, phase: "round_summary", winnerIds: [] };
  }
  const topScore = Math.max(...state.players.map((player) => player.totalScore));
  return {
    ...state,
    phase: "finished",
    winnerIds: state.players.filter((player) => player.totalScore === topScore).map((player) => player.id),
    decisionPendingPlayerId: null,
    selectedPropositionId: null
  };
};

const resolveRoundIfEnded = (state: MatchState): MatchState => {
  const card = getCurrentCard(state);
  const allRevealed = state.revealedPropositionIds.length >= card.propositions.length;
  const noActivePlayer = getActivePlayers(state).length === 0;
  if (!allRevealed && !noActivePlayer) {
    return state;
  }
  const settledPlayers = state.players.map((player) =>
    player.status === "active" && player.tempScore > 0
      ? { ...player, totalScore: player.totalScore + player.tempScore, tempScore: 0, status: "stopped" as const }
      : player
  );
  return finishMatchIfNeeded({
    ...state,
    players: settledPlayers,
    decisionPendingPlayerId: null,
    selectedPropositionId: null
  });
};

export const useAppStore = create<AppState>((set, get) => ({
  cards,
  savedPaths: loadPaths(cards),
  matchState: null,
  setupPlayers: ["Joueur 1"],
  targetPointsToWin: 30,
  selectedCardIdsForMatch: [],
  setPlayerName: (index, name) =>
    set((state) => {
      const updated = [...state.setupPlayers];
      updated[index] = name;
      return { setupPlayers: updated };
    }),
  addPlayer: () =>
    set((state) =>
      state.setupPlayers.length >= 10
        ? state
        : { setupPlayers: [...state.setupPlayers, `Joueur ${state.setupPlayers.length + 1}`] }
    ),
  removePlayer: (index) =>
    set((state) => {
      if (state.setupPlayers.length <= 1) {
        return state;
      }
      const updated = state.setupPlayers.filter((_, currentIndex) => currentIndex !== index);
      return { setupPlayers: updated };
    }),
  setTargetPointsToWin: (points) =>
    set(() => ({
      targetPointsToWin: Math.max(1, Math.min(999, points))
    })),
  addCardToMatchSelection: (cardId) =>
    set((state) => {
      if (!state.cards.some((card) => card.id === cardId) || state.selectedCardIdsForMatch.includes(cardId)) {
        return state;
      }
      return { selectedCardIdsForMatch: [...state.selectedCardIdsForMatch, cardId] };
    }),
  removeCardFromMatchSelection: (cardId) =>
    set((state) => ({
      selectedCardIdsForMatch: state.selectedCardIdsForMatch.filter((id) => id !== cardId)
    })),
  moveSelectedCardInMatch: (cardId, direction) =>
    set((state) => {
      const currentIndex = state.selectedCardIdsForMatch.indexOf(cardId);
      if (currentIndex < 0) {
        return state;
      }
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= state.selectedCardIdsForMatch.length) {
        return state;
      }
      const updated = [...state.selectedCardIdsForMatch];
      const [moved] = updated.splice(currentIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return { selectedCardIdsForMatch: updated };
    }),
  setCardSelectionForMatch: (cardIds) =>
    set((state) => ({
      selectedCardIdsForMatch: cardIds.filter((cardId) => state.cards.some((card) => card.id === cardId))
    })),
  createPathFromSelection: (name, category) => {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const state = get();
    if (!trimmedName) {
      return "Le nom du parcours est obligatoire.";
    }
    if (!trimmedCategory) {
      return "La catégorie du parcours est obligatoire.";
    }
    if (state.selectedCardIdsForMatch.length === 0) {
      return "Ajoute au moins une carte dans le parcours avant de sauvegarder.";
    }
    const created: SavedPath = {
      id: `path_${crypto.randomUUID()}`,
      name: trimmedName,
      category: trimmedCategory,
      cardIds: [...state.selectedCardIdsForMatch]
    };
    const updated = [...state.savedPaths, created];
    savePaths(updated);
    set({ savedPaths: updated });
    return null;
  },
  updatePathFromSelection: (pathId, name, category) => {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const state = get();
    if (!trimmedName) {
      return "Le nom du parcours est obligatoire.";
    }
    if (!trimmedCategory) {
      return "La catégorie du parcours est obligatoire.";
    }
    if (state.selectedCardIdsForMatch.length === 0) {
      return "Ajoute au moins une carte dans le parcours avant de sauvegarder.";
    }
    const exists = state.savedPaths.some((path) => path.id === pathId);
    if (!exists) {
      return "Parcours introuvable.";
    }
    const updated = state.savedPaths.map((path) =>
      path.id === pathId
        ? {
            ...path,
            name: trimmedName,
            category: trimmedCategory,
            cardIds: [...state.selectedCardIdsForMatch]
          }
        : path
    );
    savePaths(updated);
    set({ savedPaths: updated });
    return null;
  },
  deletePath: (pathId) =>
    set((state) => {
      const updated = state.savedPaths.filter((path) => path.id !== pathId);
      savePaths(updated);
      return { savedPaths: updated };
    }),
  startMatch: () => {
    const state = get();
    if (state.selectedCardIdsForMatch.length === 0) {
      return "Sélectionne au moins une carte pour la partie.";
    }
    const orderedCards = state.selectedCardIdsForMatch
      .map((id) => state.cards.find((card) => card.id === id))
      .filter((card): card is QuestionCard => Boolean(card));
    if (orderedCards.length === 0) {
      return "Aucune carte exploitable dans la sélection.";
    }
    const players: MatchPlayer[] = state.setupPlayers.map((name, index) => ({
      id: `p_${index + 1}`,
      name: name.trim() || `Joueur ${index + 1}`,
      totalScore: 0,
      tempScore: 0,
      status: "active"
    }));
    set({
      matchState: {
        phase: "in_round",
        targetPointsToWin: state.targetPointsToWin,
        orderedCards,
        currentCardIndex: 0,
        currentPlayerId: players[0].id,
        players,
        revealedPropositionIds: [],
        selectedPropositionId: null,
        decisionPendingPlayerId: null,
        wrongAnswerFeedback: null,
        pendingFreeTextValidation: null,
        winnerIds: []
      }
    });
    return null;
  },
  selectProposition: (propositionId) =>
    set((state) => {
      const match = state.matchState;
      if (!match || match.phase !== "in_round" || match.decisionPendingPlayerId) {
        return state;
      }
      const current = match.players.find((player) => player.id === match.currentPlayerId);
      if (!current || current.status !== "active" || match.revealedPropositionIds.includes(propositionId)) {
        return state;
      }
      return { matchState: { ...match, selectedPropositionId: propositionId } };
    }),
  answerSelectedProposition: (answer) =>
    set((state) => {
      const match = state.matchState;
      if (!match || match.phase !== "in_round" || !match.selectedPropositionId) {
        return state;
      }
      const card = getCurrentCard(match);
      const proposition = card.propositions.find((item) => item.id === match.selectedPropositionId);
      const current = match.players.find((player) => player.id === match.currentPlayerId);
      if (!proposition || !current || current.status !== "active") {
        return state;
      }
      const isCorrect = isAnswerCorrect(card.type, proposition.correctAnswer, answer);
      if (card.type === "free_text" && !isCorrect) {
        return {
          matchState: {
            ...match,
            pendingFreeTextValidation: {
              propositionId: proposition.id,
              submittedAnswer: answer.trim(),
              expectedAnswer: proposition.correctAnswer
            }
          }
        };
      }
      if (isCorrect) {
        const updatedPlayers = match.players.map((player) =>
          player.id === current.id ? { ...player, tempScore: player.tempScore + 1 } : player
        );
        const updated: MatchState = {
          ...match,
          players: updatedPlayers,
          revealedPropositionIds: [...match.revealedPropositionIds, proposition.id],
          selectedPropositionId: null,
          decisionPendingPlayerId: current.id,
          wrongAnswerFeedback: null,
          pendingFreeTextValidation: null
        };
        if (updated.players.some((player) => player.totalScore + player.tempScore >= updated.targetPointsToWin)) {
          return { matchState: finishMatchIfNeeded(updated) };
        }
        return { matchState: resolveRoundIfEnded(updated) };
      }
      const updatedPlayers = match.players.map((player) =>
        player.id === current.id ? { ...player, tempScore: 0, status: "eliminated" as const } : player
      );
      const updatedMatch = resolveRoundIfEnded({
        ...match,
        players: updatedPlayers,
        revealedPropositionIds: [...match.revealedPropositionIds, proposition.id],
        selectedPropositionId: null,
        decisionPendingPlayerId: null,
        wrongAnswerFeedback: null,
        pendingFreeTextValidation: null
      });
      if (updatedMatch.phase !== "in_round") {
        return { matchState: updatedMatch };
      }
      const nextPlayerId = getNextActivePlayerId(updatedMatch, current.id);
      return {
        matchState: {
          ...updatedMatch,
          pendingFreeTextValidation: null,
          wrongAnswerFeedback: {
            message: `Mauvaise réponse pour "${proposition.text}".`,
            nextPlayerId
          }
        }
      };
    }),
  validateFreeTextAsCorrect: () =>
    set((state) => {
      const match = state.matchState;
      if (!match || match.phase !== "in_round" || !match.pendingFreeTextValidation || !match.selectedPropositionId) {
        return state;
      }
      const current = match.players.find((player) => player.id === match.currentPlayerId);
      if (!current || current.status !== "active") {
        return state;
      }
      const updatedPlayers = match.players.map((player) =>
        player.id === current.id ? { ...player, tempScore: player.tempScore + 1 } : player
      );
      const updated: MatchState = {
        ...match,
        players: updatedPlayers,
        revealedPropositionIds: [...match.revealedPropositionIds, match.pendingFreeTextValidation.propositionId],
        selectedPropositionId: null,
        decisionPendingPlayerId: current.id,
        wrongAnswerFeedback: null,
        pendingFreeTextValidation: null
      };
      if (updated.players.some((player) => player.totalScore + player.tempScore >= updated.targetPointsToWin)) {
        return { matchState: finishMatchIfNeeded(updated) };
      }
      return { matchState: resolveRoundIfEnded(updated) };
    }),
  validateFreeTextAsWrong: () =>
    set((state) => {
      const match = state.matchState;
      if (!match || match.phase !== "in_round" || !match.pendingFreeTextValidation) {
        return state;
      }
      const current = match.players.find((player) => player.id === match.currentPlayerId);
      if (!current || current.status !== "active") {
        return state;
      }
      const updatedPlayers = match.players.map((player) =>
        player.id === current.id ? { ...player, tempScore: 0, status: "eliminated" as const } : player
      );
      const updatedMatch = resolveRoundIfEnded({
        ...match,
        players: updatedPlayers,
        revealedPropositionIds: [...match.revealedPropositionIds, match.pendingFreeTextValidation.propositionId],
        selectedPropositionId: null,
        decisionPendingPlayerId: null,
        wrongAnswerFeedback: null,
        pendingFreeTextValidation: null
      });
      if (updatedMatch.phase !== "in_round") {
        return { matchState: updatedMatch };
      }
      const nextPlayerId = getNextActivePlayerId(updatedMatch, current.id);
      return {
        matchState: {
          ...updatedMatch,
          wrongAnswerFeedback: {
            message: "Mauvaise réponse.",
            nextPlayerId
          }
        }
      };
    }),
  secureAndStopTurn: () =>
    set((state) => {
      const match = state.matchState;
      if (!match || match.phase !== "in_round" || !match.decisionPendingPlayerId) {
        return state;
      }
      const playerId = match.decisionPendingPlayerId;
      const updatedPlayers = match.players.map((player) =>
        player.id === playerId
          ? { ...player, totalScore: player.totalScore + player.tempScore, tempScore: 0, status: "stopped" as const }
          : player
      );
      const updated = resolveRoundIfEnded({
        ...match,
        players: updatedPlayers,
        decisionPendingPlayerId: null,
        selectedPropositionId: null
      });
      if (updated.phase !== "in_round") {
        return { matchState: updated };
      }
      const nextPlayerId = getNextActivePlayerId(updated, playerId);
      return { matchState: nextPlayerId ? { ...updated, currentPlayerId: nextPlayerId } : updated };
    }),
  riskAndContinueTurn: () =>
    set((state) => {
      const match = state.matchState;
      if (!match || match.phase !== "in_round" || !match.decisionPendingPlayerId) {
        return state;
      }
      const samePlayer = match.players.find((player) => player.id === match.decisionPendingPlayerId);
      if (!samePlayer || samePlayer.status !== "active") {
        return state;
      }
      return {
        matchState: {
          ...match,
          // Continue means the exact same player keeps the turn.
          currentPlayerId: match.decisionPendingPlayerId,
          decisionPendingPlayerId: null
        }
      };
    }),
  acknowledgeWrongAnswerFeedback: () =>
    set((state) => {
      const match = state.matchState;
      if (!match || !match.wrongAnswerFeedback) {
        return state;
      }
      return {
        matchState: {
          ...match,
          currentPlayerId: match.wrongAnswerFeedback.nextPlayerId ?? match.currentPlayerId,
          wrongAnswerFeedback: null,
          pendingFreeTextValidation: null
        }
      };
    }),
  continueAfterRound: () =>
    set((state) => {
      const match = state.matchState;
      if (!match || match.phase !== "round_summary") {
        return state;
      }
      const nextIndex = match.currentCardIndex + 1;
      if (nextIndex >= match.orderedCards.length) {
        return { matchState: finishMatchIfNeeded({ ...match, phase: "finished" }) };
      }
      const nextPlayers = match.players.map((player) => ({ ...player, tempScore: 0, status: "active" as const }));
      return {
        matchState: {
          ...match,
          phase: "in_round",
          currentCardIndex: nextIndex,
          currentPlayerId: nextPlayers[nextIndex % nextPlayers.length].id,
          players: nextPlayers,
          revealedPropositionIds: [],
          selectedPropositionId: null,
          decisionPendingPlayerId: null,
          wrongAnswerFeedback: null,
          pendingFreeTextValidation: null
        }
      };
    }),
  terminateMatch: () => set({ matchState: null }),
  addCard: (title, type, propositions, binaryChoices) => {
    if (type === "binary_choice") {
      if (!binaryChoices || binaryChoices.length !== 2 || binaryChoices.some((choice) => !choice.trim())) {
        return "Les deux choix fermés sont obligatoires.";
      }
      const validAnswers = new Set(binaryChoices.map((choice) => choice.trim()));
      if (propositions.some((proposition) => !validAnswers.has(proposition.correctAnswer.trim()))) {
        return "Chaque réponse doit être l'un des deux choix définis.";
      }
    }
    if (!title.trim()) {
      return "Le titre de la carte est obligatoire.";
    }
    if (
      propositions.length !== 10 ||
      propositions.some((proposition) => !proposition.text.trim() || !proposition.correctAnswer.trim())
    ) {
      return "Les 10 propositions doivent être renseignées.";
    }
    const state = get();
    const normalizedTitle = title.trim().toLowerCase();
    if (state.cards.some((card) => card.title.trim().toLowerCase() === normalizedTitle)) {
      return "Une carte avec ce titre existe déjà.";
    }
    const updatedCards = [
      ...state.cards,
      createCard(
        title,
        type,
        propositions,
        type === "binary_choice" && binaryChoices
          ? [binaryChoices[0].trim(), binaryChoices[1].trim()]
          : undefined
      )
    ];
    saveCards(updatedCards);
    set({
      cards: updatedCards
    });
    return null;
  },
  updateCard: (cardId, title, type, propositions, binaryChoices) => {
    if (type === "binary_choice") {
      if (!binaryChoices || binaryChoices.length !== 2 || binaryChoices.some((choice) => !choice.trim())) {
        return "Les deux choix fermés sont obligatoires.";
      }
      const validAnswers = new Set(binaryChoices.map((choice) => choice.trim()));
      if (propositions.some((proposition) => !validAnswers.has(proposition.correctAnswer.trim()))) {
        return "Chaque réponse doit être l'un des deux choix définis.";
      }
    }
    if (!title.trim()) {
      return "Le titre de la carte est obligatoire.";
    }
    if (
      propositions.length !== 10 ||
      propositions.some((proposition) => !proposition.text.trim() || !proposition.correctAnswer.trim())
    ) {
      return "Les 10 propositions doivent être renseignées.";
    }
    const state = get();
    const normalizedTitle = title.trim().toLowerCase();
    if (state.cards.some((card) => card.id !== cardId && card.title.trim().toLowerCase() === normalizedTitle)) {
      return "Une autre carte porte déjà ce titre.";
    }
    const updatedCards = state.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            title: title.trim(),
            type,
            binaryChoices:
              type === "binary_choice" && binaryChoices
                ? ([binaryChoices[0].trim(), binaryChoices[1].trim()] as [string, string])
                : undefined,
            propositions: card.propositions.map((item, index) => ({
              ...item,
              text: propositions[index].text.trim(),
              correctAnswer: propositions[index].correctAnswer
            }))
          }
        : card
    );
    saveCards(updatedCards);
    set({ cards: updatedCards });
    return null;
  },
  deleteCard: (cardId) =>
    set((state) => {
      const updatedCards = state.cards.filter((card) => card.id !== cardId);
      const updatedPaths = state.savedPaths.map((path) => ({
        ...path,
        cardIds: path.cardIds.filter((id) => id !== cardId)
      }));
      saveCards(updatedCards);
      savePaths(updatedPaths);
      return {
        cards: updatedCards,
        savedPaths: updatedPaths,
        selectedCardIdsForMatch: state.selectedCardIdsForMatch.filter((id) => id !== cardId)
      };
    }),
  exportCards: (subset) => exportCards(subset ?? get().cards),
  importCards: (raw) => {
    const imported = importCardsFromJson(raw);
    if (!imported) {
      return false;
    }
    const state = get();
    const importedAsAdditions = imported.map(cloneImportedCardWithNewIds);
    const updatedCards = [...state.cards, ...importedAsAdditions];
    saveCards(updatedCards);
    set({ cards: updatedCards });
    return true;
  }
}));
