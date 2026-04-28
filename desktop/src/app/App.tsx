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
      <p className="counter-text">Configure les prénoms des joueurs et les paramètres de partie.</p>
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
      <div className="target-points-panel">
        <p className="counter-text">Objectif actuel</p>
        <div className="target-points-value">{targetPointsToWin} points</div>
      </div>
      <div className="points-selector target-points-selector">
        {[10, 15, 20, 25, 30, 40, 50].map((value) => (
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
      <label htmlFor="target-points-input">Valeur personnalisée</label>
      <input
        id="target-points-input"
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
        placeholder="Ex: 30"
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
  const [ioMode, setIoMode] = useState<"none" | "export" | "import">("none");
  const [importFlow, setImportFlow] = useState<"none" | "json_ready" | "from_photo">("none");
  const [selectedExportCardIds, setSelectedExportCardIds] = useState<string[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [importError, setImportError] = useState("");
  const [isCardsMenuOpen, setIsCardsMenuOpen] = useState(false);

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

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
      sounds.correct();
    } catch (_error) {
      setMessage("Impossible de copier automatiquement. Copie manuellement le texte affiché.");
      sounds.wrong();
    }
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
    let error: string | null = null;
    try {
      error = addCard(title, questionType, propositions, binaryChoices);
    } catch (caughtError) {
      error = caughtError instanceof Error ? caughtError.message : "Impossible de créer la carte.";
    }
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
      <div className="cards-section-header">
        <div>
          <h2>Cartes disponibles</h2>
          <p className="counter-text">Base actuelle: {cardCountLabel}</p>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="icon-circle-button"
            aria-label="Menu des cartes"
            title="Menu des cartes"
            onClick={() => setIsCardsMenuOpen((previous) => !previous)}
          >
            ≡
          </button>
          <button
            type="button"
            className="icon-circle-button"
            aria-label="Ajouter une carte"
            title="Ajouter une carte"
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
            +
          </button>
        </div>
      </div>
      {isCardsMenuOpen ? (
        <div className="cards-menu-popover">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setIoMode("export");
              setSelectedExportCardIds(cards.map((card) => card.id));
              setMessage("Mode export activé.");
              setIsCardsMenuOpen(false);
              sounds.navigate();
            }}
          >
            Exporter des cartes
          </button>
          <button
            type="button"
            onClick={() => {
              setIoMode("import");
              setImportFlow("none");
              setMessage("Mode import activé.");
              setIsCardsMenuOpen(false);
              sounds.navigate();
            }}
          >
            Importer des cartes
          </button>
        </div>
      ) : null}
      {message ? <p className="status-message">{message}</p> : null}
      {importError ? <p className="status-message status-error">{importError}</p> : null}

      <h3>Tableau des cartes</h3>
      <ul className="cards-grid">
        {cards.map((card) => (
          <li
            key={card.id}
            className={selectedCardId === card.id ? "card-tile is-active" : "card-tile"}
            role="button"
            tabIndex={0}
            onClick={() => {
              sounds.click();
              openEditModal(card.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                sounds.click();
                openEditModal(card.id);
              }
            }}
          >
            <div className="card-tile-header">
              <strong>{card.title}</strong>
              <span>{QUESTION_TYPE_LABELS[card.type]}</span>
            </div>
            <div className="card-tile-propositions">
              <p className="counter-text">Propositions ({card.propositions.length})</p>
              <ul>
                {card.propositions.map((proposition, index) => (
                  <li key={proposition.id}>
                    {index + 1}. {proposition.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-tile-actions">
              <button
                type="button"
                className="danger-button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (selectedCardId === card.id) {
                    setSelectedCardId(null);
                  }
                  const confirmed = window.confirm("Supprimer définitivement cette carte ?");
                  if (!confirmed) {
                    return;
                  }
                  sounds.wrong();
                  deleteCard(card.id);
                }}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>

      <hr className="section-separator" />
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
              onClick={async () => {
                const exportable = cards.filter((card) => selectedExportCardIds.includes(card.id));
                if (exportable.length === 0) {
                  setImportError("Sélectionne au moins une carte avant de copier.");
                  sounds.wrong();
                  return;
                }
                const payload = exportCards(exportable);
                setImportError("");
                await copyToClipboard(payload, `${exportable.length} carte(s) copiée(s) en JSON.`);
              }}
            >
              Copier
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
        </div>
      ) : null}
      {ioMode === "import" ? (
        <div className="panel">
          <h4>Page Import JSON</h4>
          {importFlow === "none" ? (
            <>
              <p className="counter-text">Choisis comment tu veux importer des cartes.</p>
              <div className="inline-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setImportFlow("json_ready");
                    setMessage("Mode import direct JSON.");
                    sounds.navigate();
                  }}
                >
                  J'ai déjà un JSON prêt à importer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportFlow("from_photo");
                    setMessage("Mode conversion photo -> JSON.");
                    sounds.navigate();
                  }}
                >
                  J'ai une photo de carte et je veux générer le JSON
                </button>
              </div>
            </>
          ) : null}
          {importFlow === "json_ready" ? (
            <>
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
                    setMessage(ok ? "Import réussi: cartes ajoutées à la base existante." : "");
                    setImportError(ok ? "" : "JSON invalide : vérifie le format avant de réessayer.");
                    if (ok) {
                      sounds.correct();
                    } else {
                      sounds.wrong();
                    }
                  }}
                >
                  Importer (ajout)
                </button>
              </div>
            </>
          ) : null}
          {importFlow === "from_photo" ? (
            <>
              <p className="counter-text">
                Prends une photo nette de la carte IRL, envoie-la à une IA, puis colle le JSON renvoyé ici pour l'import.
              </p>
              <textarea
                rows={12}
                readOnly
                value={`Tu es un assistant qui transforme une carte Smart10 en JSON strictement importable.
Analyse la photo et retourne uniquement un JSON valide (sans markdown) au format suivant:
[
  {
    "id": "card_custom_1",
    "title": "Titre de la carte",
    "type": "true_false | ranking | binary_choice | free_text",
    "binaryChoices": ["choix 1", "choix 2"],
    "propositions": [
      { "id": "p_1", "text": "Proposition 1", "correctAnswer": "..." },
      { "id": "p_2", "text": "Proposition 2", "correctAnswer": "..." }
      // continuer jusqu'à 10 propositions
    ]
  }
]

Règles:
- Toujours 10 propositions.
- type=true_false => correctAnswer = "true" ou "false"
- type=ranking => correctAnswer = "1" à "10"
- type=binary_choice => fournir binaryChoices (2 valeurs) et chaque correctAnswer doit être une de ces 2 valeurs
- type=free_text => correctAnswer texte libre.
`}
              />
              <div className="inline-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={async () => {
                    const prompt = `Tu es un assistant qui transforme une carte Smart10 en JSON strictement importable.
Analyse la photo et retourne uniquement un JSON valide (sans markdown) au format suivant:
[
  {
    "id": "card_custom_1",
    "title": "Titre de la carte",
    "type": "true_false | ranking | binary_choice | free_text",
    "binaryChoices": ["choix 1", "choix 2"],
    "propositions": [
      { "id": "p_1", "text": "Proposition 1", "correctAnswer": "..." },
      { "id": "p_2", "text": "Proposition 2", "correctAnswer": "..." }
    ]
  }
]

Règles:
- Toujours 10 propositions.
- type=true_false => correctAnswer = "true" ou "false"
- type=ranking => correctAnswer = "1" à "10"
- type=binary_choice => fournir binaryChoices (2 valeurs) et chaque correctAnswer doit être une de ces 2 valeurs
- type=free_text => correctAnswer texte libre.`;
                    await copyToClipboard(prompt, "Prompt IA copié.");
                  }}
                >
                  Copier le prompt IA
                </button>
              </div>
              <textarea
                rows={10}
                placeholder="Colle ici le JSON retourné par l'IA."
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
              <div className="inline-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    const ok = importCards(importText);
                    setMessage(ok ? "Import réussi: cartes ajoutées à la base existante." : "");
                    setImportError(ok ? "" : "JSON invalide : vérifie le format avant de réessayer.");
                    if (ok) {
                      sounds.correct();
                    } else {
                      sounds.wrong();
                    }
                  }}
                >
                  Importer le JSON IA (ajout)
                </button>
              </div>
            </>
          ) : null}
          <div className="inline-actions">
            {importFlow !== "none" ? (
              <button
                type="button"
                onClick={() => {
                  setImportFlow("none");
                  sounds.navigate();
                }}
              >
                Retour au choix
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setIoMode("none");
                setImportFlow("none");
                sounds.navigate();
              }}
            >
              Retour
            </button>
          </div>
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
  const [pathModalMode, setPathModalMode] = useState<"none" | "create" | "edit" | "view">("none");
  const [pathModalError, setPathModalError] = useState("");
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
  };

  const closePathModal = () => {
    setPathModalMode("none");
    setPathModalError("");
  };

  const openCreatePathModal = () => {
    setSelectedPathId("");
    setPathName("");
    setPathCategory("");
    setCardSelectionForMatch([]);
    setPathModalError("");
    setPathModalMode("create");
    sounds.openModal();
  };

  const openEditPathModal = () => {
    if (!selectedPathId) {
      setMatchMessage("Sélectionne d'abord un parcours à modifier.");
      sounds.wrong();
      return;
    }
    const path = savedPaths.find((item) => item.id === selectedPathId);
    if (!path) {
      setMatchMessage("Parcours introuvable.");
      sounds.wrong();
      return;
    }
    setPathName(path.name);
    setPathCategory(path.category);
    setCardSelectionForMatch(path.cardIds);
    setPathModalError("");
    setPathModalMode("edit");
    sounds.openModal();
  };

  const openViewPathModal = (pathId: string) => {
    const path = savedPaths.find((item) => item.id === pathId);
    if (!path) {
      setMatchMessage("Parcours introuvable.");
      sounds.wrong();
      return;
    }
    loadPath(path.id);
    setPathModalError("");
    setPathModalMode("view");
    sounds.openModal();
  };

  const savePathFromModal = () => {
    if (pathModalMode === "create") {
      const error = createPathFromSelection(pathName, pathCategory);
      if (error) {
        setPathModalError(error);
        sounds.wrong();
        return;
      }
      setMatchMessage("Parcours créé.");
      closePathModal();
      sounds.correct();
      return;
    }

    if (pathModalMode === "edit") {
      if (!selectedPathId) {
        setPathModalError("Sélectionne un parcours à mettre à jour.");
        sounds.wrong();
        return;
      }
      const error = updatePathFromSelection(selectedPathId, pathName, pathCategory);
      if (error) {
        setPathModalError(error);
        sounds.wrong();
        return;
      }
      setMatchMessage("Parcours mis à jour.");
      closePathModal();
      sounds.correct();
    }
  };

  const deleteSelectedPathFromModal = () => {
    if (!selectedPathId) {
      setPathModalError("Sélectionne un parcours à supprimer.");
      sounds.wrong();
      return;
    }
    const confirmed = window.confirm("Supprimer définitivement ce parcours ?");
    if (!confirmed) {
      return;
    }
    deletePath(selectedPathId);
    setSelectedPathId("");
    setPathName("");
    setPathCategory("");
    setCardSelectionForMatch([]);
    setMatchMessage("Parcours supprimé.");
    closePathModal();
    sounds.wrong();
  };

  return (
    <div className="panel">
      <h2>Parcours</h2>
      <p className="counter-text">Choisis un parcours pour la partie, ou ouvre une modale pour le créer/modifier.</p>
      <div className="inline-actions">
        <button type="button" className="primary-button" onClick={openCreatePathModal}>
          Créer un parcours
        </button>
      </div>
      <ul className="question-list">
        {savedPaths.map((path) => (
          <li
            key={path.id}
            className={selectedPathId === path.id ? "card-item is-active" : "card-item"}
            role="button"
            tabIndex={0}
            onClick={() => {
              sounds.click();
              loadPath(path.id);
              setMatchMessage(`Parcours sélectionné: ${path.name}.`);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                sounds.click();
                loadPath(path.id);
                setMatchMessage(`Parcours sélectionné: ${path.name}.`);
              }
            }}
          >
            <div className="card-item-content">
              <strong>{path.name}</strong>
              <span>
                {path.category} · {path.cardIds.length} carte(s)
              </span>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  sounds.click();
                  openViewPathModal(path.id);
                }}
              >
                Voir
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedPathId(path.id);
                  setPathName(path.name);
                  setPathCategory(path.category);
                  setCardSelectionForMatch(path.cardIds);
                  setPathModalError("");
                  setPathModalMode("edit");
                  sounds.openModal();
                }}
              >
                Modifier
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={(event) => {
                  event.stopPropagation();
                  const confirmed = window.confirm(`Supprimer définitivement le parcours "${path.name}" ?`);
                  if (!confirmed) {
                    return;
                  }
                  deletePath(path.id);
                  if (selectedPathId === path.id) {
                    setSelectedPathId("");
                    setPathName("");
                    setPathCategory("");
                    setCardSelectionForMatch([]);
                  }
                  setMatchMessage("Parcours supprimé.");
                  sounds.wrong();
                }}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
      {matchMessage ? <p className="status-message">{matchMessage}</p> : null}
      {pathModalMode !== "none" ? (
        <div className="modal-backdrop" onClick={closePathModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>
              {pathModalMode === "create"
                ? "Créer un parcours"
                : pathModalMode === "edit"
                  ? "Modifier le parcours"
                  : "Voir le parcours"}
            </h3>
            {pathModalError ? <div className="modal-alert">{pathModalError}</div> : null}
            <label htmlFor="path-name-input">Nom du parcours</label>
            <input
              id="path-name-input"
              value={pathName}
              placeholder="Ex: Histoire rapide"
              readOnly={pathModalMode === "view"}
              onChange={(event) => setPathName(event.target.value)}
            />
            <label htmlFor="path-category-input">Catégorie générale</label>
            <input
              id="path-category-input"
              value={pathCategory}
              placeholder="Ex: Culture générale"
              readOnly={pathModalMode === "view"}
              onChange={(event) => setPathCategory(event.target.value)}
            />
            <div className="launch-grid">
              {pathModalMode !== "view" ? (
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
              ) : null}
              <div>
                <h4>Cartes du parcours</h4>
                <ul className="compact-list">
                  {selectedCards.map((card, index) => (
                    <li key={`selected_${card.id}`}>
                      <span>
                        {index + 1}. {card.title}
                      </span>
                      {pathModalMode !== "view" ? (
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
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="modal-actions">
              {pathModalMode === "edit" ? (
                <button type="button" className="danger-button" onClick={deleteSelectedPathFromModal}>
                  Supprimer
                </button>
              ) : null}
              <button type="button" onClick={closePathModal}>
                {pathModalMode === "view" ? "Fermer" : "Annuler"}
              </button>
              {pathModalMode !== "view" ? (
                <button type="button" className="primary-button" onClick={savePathFromModal}>
                  {pathModalMode === "create" ? "Créer le parcours" : "Enregistrer"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const App = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [textAnswer, setTextAnswer] = useState("");
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerDuration, setTimerDuration] = useState(30);
  const [setupError, setSetupError] = useState("");
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

  useEffect(() => {
    if (matchState?.phase !== "in_round") {
      setTimerRemaining(null);
      setTimerDuration(30);
    }
  }, [matchState?.phase]);

  useEffect(() => {
    if (matchState?.phase !== "in_round" || timerRemaining === null || timerRemaining <= 0) {
      return;
    }
    const interval = window.setInterval(() => {
      setTimerRemaining((previous) => {
        if (previous === null) {
          return null;
        }
        const next = previous - 1;
        if (next <= 0) {
          sounds.timerEnd();
          return 0;
        }
        sounds.timerTick();
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [matchState?.phase, timerRemaining, sounds]);

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
            <h1>Smart10 — Partie</h1>
            <p>
              Carte {matchState.currentCardIndex + 1} / {matchState.orderedCards.length} · Objectif {matchState.targetPointsToWin}
            </p>
          </header>

          <div className="panel game-question-panel">
            <div className="timer-controls">
              <div className={`timer-pill ${timerRemaining !== null && timerRemaining <= 5 ? "is-danger" : ""}`}>
                Timer: {timerRemaining === null ? "Arrêté" : `${timerRemaining}s`}
              </div>
              <div className="points-selector">
                {[15, 30, 45].map((value) => (
                  <button
                    key={`in_game_timer_${value}`}
                    type="button"
                    className={timerDuration === value ? "points-button is-active" : "points-button"}
                    onClick={() => setTimerDuration(value)}
                  >
                    {value}s
                  </button>
                ))}
              </div>
              <div className="inline-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setTimerRemaining(timerDuration);
                    sounds.navigate();
                  }}
                  disabled={Boolean(decisionPlayer) || Boolean(wrongFeedback)}
                >
                  Déclencher le timer
                </button>
                <button
                  type="button"
                  onClick={() => setTimerRemaining(null)}
                  disabled={timerRemaining === null}
                >
                  Stop
                </button>
              </div>
            </div>
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
    const rankedPlayers = matchState.players.slice().sort((first, second) => second.totalScore - first.totalScore);
    return (
      <main>
        <section className="editor-card game-shell">
          <header className="editor-header">
            <h1>Classement final — Smart10</h1>
            <p>
              Gagnant{winners.length > 1 ? "s" : ""}: {winners.map((player) => player.name).join(", ")}
            </p>
          </header>
          <div className="panel">
            <ul className="score-list podium-list">
              {rankedPlayers.map((player, index) => (
                <li
                  key={player.id}
                  className={
                    index === 0
                      ? "podium-item podium-gold"
                      : index === 1
                        ? "podium-item podium-silver"
                        : index === 2
                          ? "podium-item podium-bronze"
                          : "podium-item"
                  }
                >
                  <span>
                    {index + 1}. {player.name}
                  </span>
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
          <h1>Smart10</h1>
          <p>Configuration de partie puis lancement.</p>
        </header>
        <StepHeader currentStep={currentStep} setCurrentStep={setCurrentStep} />
        <div className="editor-grid">
          {currentStep === 0 ? <PlayersSection /> : null}
          {currentStep === 2 ? <MatchOrderSection /> : null}
          <QuestionEditor currentStep={currentStep} />
        </div>
        <div className="wizard-actions">
          {setupError ? <p className="status-message status-error">{setupError}</p> : null}
          <button
            type="button"
            disabled={currentStep === 0}
            onClick={() => {
              sounds.navigate();
              setSetupError("");
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
                  setSetupError(error);
                  return;
                }
                sounds.navigate();
                setSetupError("");
                return;
              }
              sounds.navigate();
              setSetupError("");
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
