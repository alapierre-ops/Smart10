import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "./store";
import { QuestionType } from "../game-engine/types";
import { createSoundEffects } from "./soundEffects";

const DEFAULT_ANSWER_BY_TYPE: Record<QuestionType, string> = {
  true_false: "true",
  ranking: "1",
  binary_choice: "homme",
  free_text: ""
};
const DEFAULT_BINARY_CHOICES: [string, string] = ["homme", "femme"];
const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  true_false: "Vrai / Faux",
  ranking: "Classement (1 à 10)",
  binary_choice: "Question fermée (2 choix personnalisés)",
  free_text: "Réponse libre"
};
const EMPTY_PROPOSITIONS = (type: QuestionType) =>
  Array.from({ length: 10 }, () => ({ text: "", correctAnswer: DEFAULT_ANSWER_BY_TYPE[type] }));
const STEPS = ["Joueurs", "Cartes", "Parcours"] as const;

const StepHeader = ({ currentStep, setCurrentStep }: { currentStep: number; setCurrentStep: (step: number) => void }) => (
  <div className="stepper">
    {STEPS.map((stepName, index) => (
      <button
        key={stepName}
        type="button"
        className={currentStep === index ? "step-pill is-active" : "step-pill"}
        onClick={() => setCurrentStep(index)}
      >
        <span>{index + 1}</span>
        {stepName}
      </button>
    ))}
  </div>
);

const PlayersSection = () => {
  const { setupPlayers, setPlayerName, addPlayer, removePlayer, targetPointsToWin, setTargetPointsToWin } = useAppStore();
  const sounds = useMemo(() => createSoundEffects(), []);

  return (
    <div className="panel">
      <h2>Joueurs</h2>
      <p className="counter-text">Configure les prénoms des joueurs.</p>
      <div className="players-list">
        {setupPlayers.map((playerName, index) => (
          <div key={`player_${index}`} className="player-row no-gm-row">
            <input
              value={playerName}
              placeholder={`Joueur ${index + 1}`}
              onChange={(event) => setPlayerName(index, event.target.value)}
            />
            <button type="button" className="danger-button" onClick={() => removePlayer(index)}>
              Retirer
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          sounds.click();
          addPlayer();
        }}
      >
        Ajouter un joueur
      </button>

      <hr className="section-separator" />
      <h3>Points à atteindre pour gagner</h3>
      <div className="points-selector">
        {[5, 8, 10, 12, 15, 20].map((value) => (
          <button
            key={`points_${value}`}
            type="button"
            className={targetPointsToWin === value ? "points-button is-active" : "points-button"}
            onClick={() => {
              sounds.click();
              setTargetPointsToWin(value);
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <input
        type="number"
        min={1}
        value={targetPointsToWin}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isNaN(parsed)) {
            return;
          }
          setTargetPointsToWin(parsed);
        }}
        placeholder="Nombre de points (ex: 30)"
      />
    </div>
  );
};

const QuestionEditor = ({ currentStep }: { currentStep: number }) => {
  const { cards, addCard, updateCard, deleteCard, exportCards, importCards } = useAppStore();
  const sounds = useMemo(() => createSoundEffects(), []);
  const [title, setTitle] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("true_false");
  const [binaryChoices, setBinaryChoices] = useState<[string, string]>(DEFAULT_BINARY_CHOICES);
  const [propositions, setPropositions] = useState(EMPTY_PROPOSITIONS("true_false"));
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [exportText, setExportText] = useState("");
  const [ioMode, setIoMode] = useState<"none" | "export" | "import">("none");
  const [selectedExportCardIds, setSelectedExportCardIds] = useState<string[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");

  const cardCountLabel = useMemo(() => `${cards.length} carte(s)`, [cards.length]);

  if (currentStep !== 1) {
    return null;
  }

  const updateProposition = (index: number, text: string) => {
    setPropositions((previous) =>
      previous.map((proposition, currentIndex) =>
        currentIndex === index ? { ...proposition, text } : proposition
      )
    );
  };

  const updatePropositionAnswer = (index: number, value: string) => {
    setPropositions((previous) =>
      previous.map((proposition, currentIndex) =>
        currentIndex === index ? { ...proposition, correctAnswer: value } : proposition
      )
    );
  };

  const toggleExportCard = (cardId: string) => {
    setSelectedExportCardIds((previous) =>
      previous.includes(cardId) ? previous.filter((id) => id !== cardId) : [...previous, cardId]
    );
  };

  const updateBinaryChoice = (index: 0 | 1, value: string) => {
    setBinaryChoices((previous) => {
      const updated: [string, string] = [...previous] as [string, string];
      updated[index] = value;
      return updated;
    });
    if (questionType !== "binary_choice") {
      return;
    }
    setPropositions((previous) =>
      previous.map((proposition) => {
        const answer = proposition.correctAnswer.trim();
        if (answer !== binaryChoices[0] && answer !== binaryChoices[1]) {
          return { ...proposition, correctAnswer: index === 0 ? value : binaryChoices[0] };
        }
        if (index === 0 && answer === binaryChoices[0]) {
          return { ...proposition, correctAnswer: value };
        }
        if (index === 1 && answer === binaryChoices[1]) {
          return { ...proposition, correctAnswer: value };
        }
        return proposition;
      })
    );
  };

  const handleCreate = () => {
    const error = addCard(title, questionType, propositions, binaryChoices);
    if (error) {
      setModalError(error);
      sounds.wrong();
      return;
    }
    setIsCreateModalOpen(false);
    setModalError("");
    setMessage("Carte créée avec succès.");
    setTitle("");
    setQuestionType("true_false");
    setBinaryChoices(DEFAULT_BINARY_CHOICES);
    setPropositions(EMPTY_PROPOSITIONS("true_false"));
    sounds.correct();
  };

  const openEditModal = (cardId: string) => {
    const card = cards.find((item) => item.id === cardId);
    if (!card) return;
    setSelectedCardId(cardId);
    setTitle(card.title);
    setQuestionType(card.type);
    setBinaryChoices(card.binaryChoices ?? DEFAULT_BINARY_CHOICES);
    setPropositions(
      card.propositions.map((item) => ({
        text: item.text,
        correctAnswer: item.correctAnswer
      }))
    );
    setModalError("");
    setIsEditModalOpen(true);
    sounds.openModal();
  };

  const handleUpdate = () => {
    if (!selectedCardId) {
      return;
    }
    const error = updateCard(selectedCardId, title, questionType, propositions, binaryChoices);
    if (error) {
      setModalError(error);
      sounds.wrong();
      return;
    }
    setIsEditModalOpen(false);
    setModalError("");
    setMessage("Carte modifiée avec succès.");
    sounds.correct();
  };

  const renderModal = (mode: "create" | "edit") => {
    const isOpen = mode === "create" ? isCreateModalOpen : isEditModalOpen;
    if (!isOpen) {
      return null;
    }
    return (
      <div className="modal-backdrop" onClick={() => (mode === "create" ? setIsCreateModalOpen(false) : setIsEditModalOpen(false))}>
        <div className="modal-card" onClick={(event) => event.stopPropagation()}>
          <h3>{mode === "create" ? "Nouvelle carte" : "Modifier la carte"}</h3>
          {modalError ? <div className="modal-alert">{modalError}</div> : null}
          <label htmlFor="title-input">Titre de la carte</label>
          <input
            id="title-input"
            value={title}
            placeholder="Ex: Cette invention vient-elle d'un homme ou d'une femme ?"
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="type-input">Type de question</label>
          <select
            id="type-input"
            value={questionType}
            onChange={(event) => {
              const nextType = event.target.value as QuestionType;
              setQuestionType(nextType);
              if (nextType === "binary_choice") {
                setBinaryChoices((previous) =>
                  previous[0].trim() && previous[1].trim() ? previous : DEFAULT_BINARY_CHOICES
                );
              }
              setPropositions((previous) =>
                previous.map((proposition) => ({
                  ...proposition,
                  correctAnswer:
                    nextType === "binary_choice"
                      ? (binaryChoices[0].trim() || DEFAULT_BINARY_CHOICES[0])
                      : DEFAULT_ANSWER_BY_TYPE[nextType]
                }))
              );
            }}
          >
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <label>10 propositions</label>
          {questionType === "binary_choice" ? (
            <div className="inline-actions">
              <input
                value={binaryChoices[0]}
                placeholder="Choix A"
                onChange={(event) => updateBinaryChoice(0, event.target.value)}
              />
              <input
                value={binaryChoices[1]}
                placeholder="Choix B"
                onChange={(event) => updateBinaryChoice(1, event.target.value)}
              />
            </div>
          ) : null}
          <div className="propositions-grid">
            {propositions.map((proposition, index) => (
              <div key={`prop_${index}`} className="proposition-row">
                <span>{index + 1}.</span>
                <input
                  value={proposition.text}
                  placeholder="Ex: Monopoly"
                  onChange={(event) => updateProposition(index, event.target.value)}
                />
                <select
                  value={proposition.correctAnswer}
                  onChange={(event) => updatePropositionAnswer(index, event.target.value)}
                >
                  {questionType === "true_false" ? (
                    <>
                      <option value="true">Vrai</option>
                      <option value="false">Faux</option>
                    </>
                  ) : null}
                  {questionType === "ranking" ? (
                    Array.from({ length: 10 }, (_, idx) => (
                      <option key={`ranking_${idx + 1}`} value={String(idx + 1)}>
                        Position {idx + 1}
                      </option>
                    ))
                  ) : null}
                  {questionType === "binary_choice" ? (
                    <>
                      <option value={binaryChoices[0]}>{binaryChoices[0] || "Choix A"}</option>
                      <option value={binaryChoices[1]}>{binaryChoices[1] || "Choix B"}</option>
                    </>
                  ) : null}
                  {questionType === "free_text" ? (
                    <option value={proposition.correctAnswer || ""}>{proposition.correctAnswer || "Réponse attendue"}</option>
                  ) : null}
                </select>
                {questionType === "free_text" ? (
                  <input
                    value={proposition.correctAnswer}
                    placeholder="Réponse attendue (ex: Sao Paulo)"
                    onChange={(event) => updatePropositionAnswer(index, event.target.value)}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" onClick={() => (mode === "create" ? setIsCreateModalOpen(false) : setIsEditModalOpen(false))}>
              Annuler
            </button>
            <button type="button" className="primary-button" onClick={mode === "create" ? handleCreate : handleUpdate}>
              {mode === "create" ? "Valider la carte" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="panel">
      <h2>Cartes disponibles</h2>
      <p className="counter-text">Base actuelle: {cardCountLabel}</p>
      <div className="inline-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setTitle("");
            setQuestionType("true_false");
            setBinaryChoices(DEFAULT_BINARY_CHOICES);
            setPropositions(EMPTY_PROPOSITIONS("true_false"));
            setModalError("");
            setIsCreateModalOpen(true);
            sounds.openModal();
          }}
        >
          Creer une carte
        </button>
      </div>
      {message ? <p className="status-message">{message}</p> : null}

      <h3>Toutes les cartes</h3>
      <ul className="question-list">
        {cards.map((card) => (
          <li
            key={card.id}
            className={selectedCardId === card.id ? "card-item is-active" : "card-item"}
            onClick={() => {
              sounds.click();
              openEditModal(card.id);
            }}
          >
            <div className="card-item-content">
              <strong>{card.title}</strong>
              <span>
                {card.propositions.length} propositions · {QUESTION_TYPE_LABELS[card.type]}
              </span>
            </div>
            <button
              type="button"
              className="danger-button"
              onClick={(event) => {
                event.stopPropagation();
                if (selectedCardId === card.id) {
                  setSelectedCardId(null);
                }
                sounds.wrong();
                deleteCard(card.id);
              }}
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <hr className="section-separator" />
      <h3>Importer / Exporter</h3>
      {ioMode === "none" ? (
        <div className="inline-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setIoMode("export");
              setSelectedExportCardIds(cards.map((card) => card.id));
              setExportText("");
              setMessage("Mode export activé.");
              sounds.navigate();
            }}
          >
            Mode Export
          </button>
          <button
            type="button"
            onClick={() => {
              setIoMode("import");
              setMessage("Mode import activé.");
              sounds.navigate();
            }}
          >
            Mode Import
          </button>
        </div>
      ) : null}
      {ioMode === "export" ? (
        <div className="panel">
          <h4>Page Export JSON</h4>
          <p className="counter-text">
            Coche les cartes à exporter, puis copie le JSON généré pour le partager/importer ailleurs.
          </p>
          <ul className="question-list">
            {cards.map((card) => (
              <li
                key={`export_${card.id}`}
                className={selectedExportCardIds.includes(card.id) ? "card-item is-active" : "card-item"}
                onClick={() => toggleExportCard(card.id)}
              >
                <div className="card-item-content">
                  <strong>{card.title}</strong>
                  <span>{QUESTION_TYPE_LABELS[card.type]}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="inline-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                const exportable = cards.filter((card) => selectedExportCardIds.includes(card.id));
                setExportText(exportCards(exportable));
                setMessage(`${exportable.length} carte(s) exportée(s) en JSON.`);
                sounds.correct();
              }}
            >
              Générer le JSON export
            </button>
            <button
              type="button"
              onClick={() => {
                setIoMode("none");
                sounds.navigate();
              }}
            >
              Retour
            </button>
          </div>
          <textarea rows={10} value={exportText} readOnly placeholder="Le JSON exporté apparaît ici." />
        </div>
      ) : null}
      {ioMode === "import" ? (
        <div className="panel">
          <h4>Page Import JSON</h4>
          <p className="counter-text">
            Colle un tableau JSON de cartes puis importe. Les cartes importées sont AJOUTÉES, jamais remplacées.
          </p>
          <textarea
            rows={10}
            placeholder="Colle ici un tableau JSON de cartes à importer."
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />
          <div className="inline-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                const ok = importCards(importText);
                setMessage(ok ? "Import réussi: cartes ajoutées à la base existante." : "JSON invalide.");
                if (ok) {
                  sounds.correct();
                } else {
                  sounds.wrong();
                }
              }}
            >
              Importer (ajout)
            </button>
            <button
              type="button"
              onClick={() => {
                setIoMode("none");
                sounds.navigate();
              }}
            >
              Retour
            </button>
          </div>
          <h4>Tuto photo carte IRL → JSON</h4>
          <p className="counter-text">
            1) Prends une photo nette de ta carte. 2) Envoie-la à une IA (ChatGPT, Claude...) avec la consigne: "Convertis
            cette carte au format JSON Smart10". 3) Demande strictement un tableau JSON importable.
          </p>
          <textarea
            rows={10}
            readOnly
            value={`[
  {
    "id": "card_custom_1",
    "title": "Titre de la carte",
    "type": "true_false | ranking | binary_choice | free_text",
    "binaryChoices": ["choix 1", "choix 2"],
    "propositions": [
      { "id": "p_1", "text": "Proposition 1", "correctAnswer": "..." }
      // ... jusqu'à 10 propositions
    ]
  }
]`}
          />
        </div>
      ) : null}

      {renderModal("create")}
      {renderModal("edit")}
    </div>
  );
};

const MatchOrderSection = () => {
  const {
    cards,
    savedPaths,
    selectedCardIdsForMatch,
    addCardToMatchSelection,
    removeCardFromMatchSelection,
    moveSelectedCardInMatch,
    setCardSelectionForMatch,
    createPathFromSelection,
    updatePathFromSelection,
    deletePath,
    startMatch
  } = useAppStore();
  const [matchMessage, setMatchMessage] = useState("");
  const [pathName, setPathName] = useState("");
  const [pathCategory, setPathCategory] = useState("");
  const [selectedPathId, setSelectedPathId] = useState<string>("");
  const [isEditingPath, setIsEditingPath] = useState(false);
  const sounds = useMemo(() => createSoundEffects(), []);
  const selectedCards = selectedCardIdsForMatch
    .map((selectedId) => cards.find((card) => card.id === selectedId))
    .filter((card): card is (typeof cards)[number] => Boolean(card));
  const availableCards = cards.filter((card) => !selectedCardIdsForMatch.includes(card.id));

  const loadPath = (pathId: string) => {
    const path = savedPaths.find((item) => item.id === pathId);
    if (!path) {
      return;
    }
    setSelectedPathId(path.id);
    setPathName(path.name);
    setPathCategory(path.category);
    setCardSelectionForMatch(path.cardIds);
    setIsEditingPath(false);
  };

  return (
    <div className="panel">
      <h2>Parcours</h2>
      <p className="counter-text">Choisis un parcours existant en cliquant sur une carte.</p>
      <ul className="question-list">
        {savedPaths.map((path) => (
          <li
            key={path.id}
            className={selectedPathId === path.id ? "card-item is-active" : "card-item"}
            onClick={() => {
              sounds.click();
              loadPath(path.id);
              setMatchMessage(`Parcours sélectionné: ${path.name}.`);
            }}
          >
            <div className="card-item-content">
              <strong>{path.name}</strong>
              <span>
                {path.category} · {path.cardIds.length} carte(s)
              </span>
            </div>
          </li>
        ))}
      </ul>
      {selectedPathId ? (
        <div className="inline-actions">
          <button
            type="button"
            onClick={() => {
              setIsEditingPath((previous) => !previous);
              sounds.navigate();
            }}
          >
            {isEditingPath ? "Fermer la modification" : "Modifier le parcours"}
          </button>
        </div>
      ) : null}

      {isEditingPath ? (
        <div className="players-list">
          <input
            value={pathName}
            placeholder="Nom du parcours"
            onChange={(event) => setPathName(event.target.value)}
          />
          <input
            value={pathCategory}
            placeholder="Catégorie générale"
            onChange={(event) => setPathCategory(event.target.value)}
          />
          <div className="inline-actions">
            {!selectedPathId ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  const error = createPathFromSelection(pathName, pathCategory);
                  setMatchMessage(error ?? "Parcours créé.");
                  if (error) {
                    sounds.wrong();
                    return;
                  }
                  sounds.correct();
                }}
              >
                Créer le parcours
              </button>
            ) : null}
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                if (!selectedPathId) {
                  setMatchMessage("Sélectionne un parcours à mettre à jour.");
                  sounds.wrong();
                  return;
                }
                const error = updatePathFromSelection(selectedPathId, pathName, pathCategory);
                setMatchMessage(error ?? "Parcours mis à jour.");
                if (error) {
                  sounds.wrong();
                  return;
                }
                sounds.correct();
              }}
            >
              Enregistrer les modifications
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                if (!selectedPathId) {
                  setMatchMessage("Sélectionne un parcours à supprimer.");
                  sounds.wrong();
                  return;
                }
                deletePath(selectedPathId);
                setSelectedPathId("");
                setPathName("");
                setPathCategory("");
                setCardSelectionForMatch([]);
                setIsEditingPath(false);
                setMatchMessage("Parcours supprimé.");
                sounds.wrong();
              }}
            >
              Supprimer le parcours
            </button>
          </div>
        </div>
      ) : null}

      {isEditingPath ? <div className="launch-grid">
        <div>
          <h4>Cartes disponibles</h4>
          <ul className="compact-list">
            {availableCards.map((card) => (
              <li key={`available_${card.id}`}>
                <span>{card.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    addCardToMatchSelection(card.id);
                    sounds.click();
                  }}
                >
                  Ajouter
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Parcours de la partie</h4>
          <ul className="compact-list">
            {selectedCards.map((card, index) => (
              <li key={`selected_${card.id}`}>
                <span>
                  {index + 1}. {card.title}
                </span>
                <div className="inline-actions">
                  <button type="button" onClick={() => moveSelectedCardInMatch(card.id, "up")}>
                    ↑
                  </button>
                  <button type="button" onClick={() => moveSelectedCardInMatch(card.id, "down")}>
                    ↓
                  </button>
                  <button type="button" onClick={() => removeCardFromMatchSelection(card.id)}>
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div> : null}
      <button
        type="button"
        className="primary-button"
        onClick={() => {
          setSelectedPathId("");
          setPathName("");
          setPathCategory("");
          setCardSelectionForMatch([]);
          setIsEditingPath(true);
          setMatchMessage("Nouveau parcours: compose ta sélection puis enregistre.");
          sounds.navigate();
        }}
      >
        Nouveau parcours
      </button>
      {matchMessage ? <p className="status-message">{matchMessage}</p> : null}
    </div>
  );
};

export const App = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [textAnswer, setTextAnswer] = useState("");
  const {
    matchState,
    selectProposition,
    answerSelectedProposition,
    secureAndStopTurn,
    riskAndContinueTurn,
    acknowledgeWrongAnswerFeedback,
    validateFreeTextAsCorrect,
    validateFreeTextAsWrong,
    continueAfterRound,
    startMatch,
    terminateMatch
  } =
    useAppStore();
  const sounds = useMemo(() => createSoundEffects(), []);
  const previousPhaseRef = useRef<string | null>(null);
  const previousDecisionPlayerRef = useRef<string | null>(null);

  const confirmEndMatch = () => {
    const ok = window.confirm(
      "Confirmer la fin de la partie ? Vous retournerez au setup avec les informations déjà remplies."
    );
    if (ok) {
      sounds.click();
      terminateMatch();
    }
  };

  useEffect(() => {
    const phase = matchState?.phase ?? null;
    const previous = previousPhaseRef.current;
    if (phase && phase !== previous) {
      if (phase === "round_summary") {
        sounds.roundEnd();
      }
      if (phase === "finished") {
        sounds.gameEnd();
      }
    }
    previousPhaseRef.current = phase;
  }, [matchState?.phase, sounds]);

  useEffect(() => {
    if (matchState?.phase !== "in_round") {
      setTextAnswer("");
    }
  }, [matchState?.phase, matchState?.selectedPropositionId, matchState?.currentCardIndex]);

  useEffect(() => {
    const currentDecisionPlayerId = matchState?.decisionPendingPlayerId ?? null;
    if (currentDecisionPlayerId && currentDecisionPlayerId !== previousDecisionPlayerRef.current) {
      sounds.correct();
    }
    previousDecisionPlayerRef.current = currentDecisionPlayerId;
  }, [matchState?.decisionPendingPlayerId, sounds]);

  if (matchState?.phase === "in_round") {
    const card = matchState.orderedCards[matchState.currentCardIndex];
    const cardBinaryChoices = card.binaryChoices ?? DEFAULT_BINARY_CHOICES;
    const currentPlayer = matchState.players.find((player) => player.id === matchState.currentPlayerId);
    const selectedProposition = card.propositions.find((prop) => prop.id === matchState.selectedPropositionId) ?? null;
    const decisionPlayer = matchState.players.find((player) => player.id === matchState.decisionPendingPlayerId) ?? null;
    const wrongFeedback = matchState.wrongAnswerFeedback;
    const pendingFreeTextValidation = matchState.pendingFreeTextValidation;
    if (!currentPlayer) {
      return null;
    }
    return (
      <main>
        <section className="editor-card game-shell">
          <header className="editor-header">
            <h1>GeniusBox — Partie</h1>
            <p>
              Carte {matchState.currentCardIndex + 1} / {matchState.orderedCards.length} · Objectif {matchState.targetPointsToWin}
            </p>
          </header>

          <div className="panel game-question-panel">
            <div className="tiny-label">Joueur actif</div>
            <h2>{currentPlayer.name}</h2>
            <p className="question-title">{card.title}</p>
            <ul className="question-list propositions-live-grid">
              {card.propositions.map((proposition) => {
                const isRevealed = matchState.revealedPropositionIds.includes(proposition.id);
                const isSelected = proposition.id === matchState.selectedPropositionId;
                return (
                  <li
                    key={proposition.id}
                    className={`${isSelected ? "card-item is-active" : "card-item"} ${isRevealed ? "is-revealed" : ""}`}
                    onClick={() => {
                      if (!isRevealed && !decisionPlayer && !wrongFeedback) {
                        sounds.click();
                        selectProposition(proposition.id);
                      }
                    }}
                  >
                    <div className="card-item-content">
                      <strong>{proposition.text}</strong>
                      <span>{isRevealed ? "Déjà répondu" : "Clique pour répondre"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="answer-actions">
              {card.type === "true_false" ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      if (selectedProposition && !decisionPlayer && !wrongFeedback) {
                        answerSelectedProposition("true");
                      }
                    }}
                    disabled={!selectedProposition || Boolean(decisionPlayer) || Boolean(wrongFeedback)}
                  >
                    Vrai
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProposition && !decisionPlayer && !wrongFeedback) {
                        answerSelectedProposition("false");
                      }
                    }}
                    disabled={!selectedProposition || Boolean(decisionPlayer) || Boolean(wrongFeedback)}
                  >
                    Faux
                  </button>
                </>
              ) : null}
              {card.type === "ranking" ? (
                <>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={textAnswer}
                    placeholder="Position 1 à 10"
                    onChange={(event) => setTextAnswer(event.target.value)}
                    disabled={!selectedProposition || Boolean(decisionPlayer) || Boolean(wrongFeedback)}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      if (!selectedProposition || !textAnswer) return;
                      answerSelectedProposition(textAnswer);
                      setTextAnswer("");
                    }}
                    disabled={!selectedProposition || Boolean(decisionPlayer) || Boolean(wrongFeedback) || !textAnswer}
                  >
                    Valider le rang
                  </button>
                </>
              ) : null}
              {card.type === "binary_choice" ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => selectedProposition && answerSelectedProposition(cardBinaryChoices[0])}
                    disabled={!selectedProposition || Boolean(decisionPlayer) || Boolean(wrongFeedback)}
                  >
                    {cardBinaryChoices[0]}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedProposition && answerSelectedProposition(cardBinaryChoices[1])}
                    disabled={!selectedProposition || Boolean(decisionPlayer) || Boolean(wrongFeedback)}
                  >
                    {cardBinaryChoices[1]}
                  </button>
                </>
              ) : null}
              {card.type === "free_text" ? (
                <>
                  <input
                    value={textAnswer}
                    placeholder="Saisis ta réponse"
                    onChange={(event) => setTextAnswer(event.target.value)}
                    disabled={!selectedProposition || Boolean(decisionPlayer) || Boolean(wrongFeedback)}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      if (!selectedProposition || !textAnswer.trim()) return;
                      answerSelectedProposition(textAnswer);
                    }}
                    disabled={!selectedProposition || Boolean(decisionPlayer) || Boolean(wrongFeedback) || !textAnswer.trim()}
                  >
                    Valider
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <h3>Scores</h3>
            <ul className="score-list">
              {matchState.players.map((player) => {
                const status = player.status === "active" ? "actif" : player.status === "stopped" ? "stop" : "éliminé";
                return (
                  <li key={player.id}>
                    <span>
                      {player.name} ({status})
                    </span>
                    <strong>{player.totalScore}</strong>
                  </li>
                );
              })}
            </ul>
            <div className="bottom-right-actions">
              <button type="button" className="danger-button" onClick={confirmEndMatch}>
                Terminer la partie
              </button>
            </div>
          </div>
        </section>
        {decisionPlayer ? (
          <div className="modal-backdrop">
            <div className="modal-card decision-modal">
              <h3>Bonne réponse</h3>
              <p>
                <strong>{decisionPlayer.name}</strong> a maintenant {decisionPlayer.tempScore} point(s) temporaire(s).
              </p>
              <p>Tu veux capitaliser tes points ou continuer pour en gagner d'autres ?</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    sounds.secure();
                    secureAndStopTurn();
                  }}
                >
                  Capitaliser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.risk();
                    riskAndContinueTurn();
                  }}
                >
                  Continuer
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {wrongFeedback ? (
          <div className="modal-backdrop">
            <div className="modal-card decision-modal">
              <h3>Réponse fausse</h3>
              <p>{wrongFeedback.message}</p>
              <p>Cette proposition est désormais marquée comme déjà répondue.</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    sounds.navigate();
                    acknowledgeWrongAnswerFeedback();
                  }}
                >
                  Tour suivant
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {pendingFreeTextValidation ? (
          <div className="modal-backdrop">
            <div className="modal-card decision-modal">
              <h3>Réponse libre à confirmer</h3>
              <p>Réponse saisie: {pendingFreeTextValidation.submittedAnswer || "(vide)"}</p>
              <p>Réponse attendue: {pendingFreeTextValidation.expectedAnswer}</p>
              <p>Tu peux valider manuellement même si ce n'est pas identique.</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    sounds.correct();
                    validateFreeTextAsCorrect();
                  }}
                >
                  Valider quand même (+1)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.wrong();
                    validateFreeTextAsWrong();
                  }}
                >
                  Compter comme faux
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (matchState?.phase === "round_summary") {
    return (
      <main>
        <section className="editor-card game-shell">
          <header className="editor-header">
            <h1>Fin de carte</h1>
            <p>Toutes les réponses de la carte sont affichées avant de passer à la suivante.</p>
          </header>
          <div className="panel">
            <h3>Réponses de la carte</h3>
            <ul className="question-list propositions-live-grid">
              {matchState.orderedCards[matchState.currentCardIndex].propositions.map((proposition) => {
                const wasFound = matchState.revealedPropositionIds.includes(proposition.id);
                return (
                  <li key={proposition.id} className={wasFound ? "card-item is-revealed" : "card-item"}>
                    <div className="card-item-content">
                      <strong>{proposition.text}</strong>
                      <span>
                        Réponse:{" "}
                        {matchState.orderedCards[matchState.currentCardIndex].type === "true_false"
                          ? proposition.correctAnswer === "true"
                            ? "Vrai"
                            : "Faux"
                          : proposition.correctAnswer}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <ul className="score-list">
              {matchState.players.map((player) => (
                <li key={player.id}>
                  <span>{player.name}</span>
                  <strong>{player.totalScore}</strong>
                </li>
              ))}
            </ul>
            <div className="answer-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  sounds.navigate();
                  continueAfterRound();
                }}
              >
                Carte suivante
              </button>
            </div>
            <div className="bottom-right-actions">
              <button type="button" className="danger-button" onClick={confirmEndMatch}>
                Terminer la partie
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (matchState?.phase === "finished") {
    const winners = matchState.players.filter((player) => matchState.winnerIds.includes(player.id));
    return (
      <main>
        <section className="editor-card game-shell">
          <header className="editor-header">
            <h1>Classement final — GeniusBox</h1>
            <p>
              Gagnant{winners.length > 1 ? "s" : ""}: {winners.map((player) => player.name).join(", ")}
            </p>
          </header>
          <div className="panel">
            <ul className="score-list">
              {matchState.players
                .slice()
                .sort((first, second) => second.totalScore - first.totalScore)
                .map((player) => (
                  <li key={player.id}>
                    <span>{player.name}</span>
                    <strong>{player.totalScore}</strong>
                  </li>
                ))}
            </ul>
            <div className="bottom-right-actions">
              <button type="button" className="danger-button" onClick={confirmEndMatch}>
                Terminer la partie
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="editor-card">
        <header className="editor-header">
          <h1>GeniusBox</h1>
          <p>Configuration de partie puis lancement.</p>
        </header>
        <StepHeader currentStep={currentStep} setCurrentStep={setCurrentStep} />
        <div className="editor-grid">
          {currentStep === 0 ? <PlayersSection /> : null}
          {currentStep === 2 ? <MatchOrderSection /> : null}
          <QuestionEditor currentStep={currentStep} />
        </div>
        <div className="wizard-actions">
          <button
            type="button"
            disabled={currentStep === 0}
            onClick={() => {
              sounds.navigate();
              setCurrentStep((prev) => prev - 1);
            }}
          >
            Étape précédente
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              if (currentStep === STEPS.length - 1) {
                const error = startMatch();
                if (error) {
                  sounds.wrong();
                  return;
                }
                sounds.navigate();
                return;
              }
              sounds.navigate();
              setCurrentStep((prev) => prev + 1);
            }}
          >
            {currentStep === STEPS.length - 1 ? "Lancer la partie" : "Étape suivante"}
          </button>
        </div>
      </section>
    </main>
  );
};
