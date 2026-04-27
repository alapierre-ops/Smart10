import samplePackData from "../data/questions/sample-pack.json";
import { QuestionCard, QuestionProposition, QuestionType, TfQuestion } from "../game-engine/types";

const STORAGE_KEY = "smart10.cards";
const REQUIRED_PROPOSITION_COUNT = 10;
const QUESTION_TYPES: QuestionType[] = ["true_false", "ranking", "binary_choice", "free_text"];
const DEFAULT_BINARY_CHOICES: [string, string] = ["homme", "femme"];

const normalizeCard = (card: QuestionCard): QuestionCard => ({
  ...card,
  type: QUESTION_TYPES.includes(card.type) ? card.type : "true_false",
  binaryChoices:
    card.type === "binary_choice"
      ? (Array.isArray(card.binaryChoices) &&
          card.binaryChoices.length === 2 &&
          card.binaryChoices.every((choice) => Boolean(String(choice).trim()))
          ? [String(card.binaryChoices[0]).trim(), String(card.binaryChoices[1]).trim()]
          : DEFAULT_BINARY_CHOICES)
      : undefined
});

const validateProposition = (proposition: QuestionProposition): boolean => {
  return (
    Boolean(proposition.id.trim()) &&
    Boolean(proposition.text.trim()) &&
    Boolean(String(proposition.correctAnswer ?? "").trim())
  );
};

const validateCard = (card: QuestionCard): boolean => {
  if (!card.id.trim() || !card.title.trim()) {
    return false;
  }
  if (!QUESTION_TYPES.includes(card.type)) {
    return false;
  }
  if (card.type === "binary_choice") {
    if (
      !Array.isArray(card.binaryChoices) ||
      card.binaryChoices.length !== 2 ||
      card.binaryChoices.some((choice) => !String(choice).trim())
    ) {
      return false;
    }
  }
  if (!Array.isArray(card.propositions) || card.propositions.length !== REQUIRED_PROPOSITION_COUNT) {
    return false;
  }
  return card.propositions.every(validateProposition);
};

const validateQuestion = (question: TfQuestion): boolean => {
  const isAnswerValid = question.correctAnswer === "true" || question.correctAnswer === "false";
  return Boolean(question.id.trim()) && Boolean(question.prompt.trim()) && isAnswerValid;
};

export const createDefaultCards = (): QuestionCard[] =>
  (samplePackData as QuestionCard[]).map(normalizeCard).filter(validateCard);

export const loadCards = (): QuestionCard[] => {
  const rawValue = localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    const defaults = createDefaultCards();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return createDefaultCards();
    }

    const asCards = (parsed as QuestionCard[]).map(normalizeCard).filter(validateCard);
    if (asCards.length > 0) {
      return asCards;
    }

    // Legacy fallback if local storage still contains old flat-question shape.
    const asQuestions = (parsed as TfQuestion[]).filter(validateQuestion);
    if (asQuestions.length === REQUIRED_PROPOSITION_COUNT) {
      const migrated: QuestionCard = {
        id: `card_${crypto.randomUUID()}`,
        title: "Carte migree",
        type: "true_false",
        propositions: asQuestions.map((question) => ({
          id: `prop_${crypto.randomUUID()}`,
          text: question.prompt,
          correctAnswer: question.correctAnswer
        }))
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([migrated]));
      return [migrated];
    }
    const defaults = createDefaultCards();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch (_error) {
    const defaults = createDefaultCards();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
};

export const saveCards = (cards: QuestionCard[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
};

export interface CardDraftProposition {
  text: string;
  correctAnswer: string;
}

export const createCard = (
  title: string,
  type: QuestionType,
  propositions: CardDraftProposition[],
  binaryChoices?: [string, string]
): QuestionCard => ({
  id: `card_${crypto.randomUUID()}`,
  title: title.trim(),
  type,
  binaryChoices: type === "binary_choice" ? (binaryChoices ?? DEFAULT_BINARY_CHOICES) : undefined,
  propositions: propositions.map((proposition) => ({
    id: `prop_${crypto.randomUUID()}`,
    text: proposition.text.trim(),
    correctAnswer: proposition.correctAnswer
  }))
});

export const exportCards = (cards: QuestionCard[]): string => JSON.stringify(cards, null, 2);

export const importCardsFromJson = (raw: string): QuestionCard[] | null => {
  try {
    const candidate = JSON.parse(raw) as QuestionCard[];
    if (!Array.isArray(candidate)) {
      return null;
    }
    const cards = candidate.map(normalizeCard).filter(validateCard);
    if (cards.length === 0) {
      return null;
    }
    return cards;
  } catch (_error) {
    return null;
  }
};

export const flattenCardsToQuestions = (cards: QuestionCard[]): TfQuestion[] =>
  cards.flatMap((card) =>
    card.type === "true_false"
      ? card.propositions.map((proposition) => ({
          id: `${card.id}_${proposition.id}`,
          prompt: `${card.title} - ${proposition.text}`,
          correctAnswer: proposition.correctAnswer === "true" ? "true" : "false"
        }))
      : []
  );
