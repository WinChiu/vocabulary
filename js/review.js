// Review Logic (ES Module)
import { $, $$, showView, showPopup } from './utils.js';
import DataService, { calculateNextReviewStats } from './data.js';

const MODE_MAP = {
  1: 'flip_en',
  2: 'flip_zh',
  3: 'spelling',
  4: 'fill_blank',
};

const MODE_WEIGHTS = {
  1: 0.5,
  2: 0.5,
  3: 1.0,
  4: 1.0,
};

// Normalization helper (Spec 3.4)
const normalize = (text) => {
  if (!text) return '';
  return text.toString().trim().toLowerCase().replace(/\s+/g, ' '); // collapse multiple spaces
};

// Familiarity Calculator (Spec 5) - Updated for new state
const calculateFamiliarity = (stats) => {
  if (!stats) return 0;

  // Map states to a score for backward compatibility with UI progress bars/filters
  if (stats.state === 'MASTERED') return 1.0;
  if (stats.state === 'LEARNING') return 0.5;
  if (stats.state === 'NEW') return 0.1;

  // Fallback to legacy calculation if state is not set
  if (stats.total_attempts === 0) return 0;
  const accuracy =
    (stats.correct_attempts || 0) / Math.max(stats.total_attempts, 1);
  const streakBonus = Math.min((stats.consecutive_correct || 0) * 0.1, 0.3);
  return Math.max(0, Math.min(1, accuracy + streakBonus));
};

export const getFamiliarityLevel = (stats) => {
  if (stats && stats.state) {
    switch (stats.state) {
      case 'MASTERED':
        return { label: 'Mastered', class: 'level-mastered' };
      case 'LEARNING':
        return { label: 'Learning', class: 'level-learning' };
      case 'NEW':
        return { label: 'New', class: 'level-new' };
    }
  }
  // Base on score if state is not available (Legacy Fallback)
  const score = calculateFamiliarity(stats);
  // Stricter fallback: Must have at least 5 attempts to be considered Mastered by score alone
  if (score >= 0.8 && (stats.total_attempts || 0) > 5)
    return { label: 'Mastered', class: 'level-mastered' };
  if (score >= 0.4) return { label: 'Learning', class: 'level-learning' };
  return { label: 'New', class: 'level-new' };
};

// Helper to create flexible regex for phrases (e.g. "look forward" -> matches "looking forward")
const createFlexibleRegex = (text) => {
  if (!text) return null;
  // escape special chars
  const escapeRegExp = (string) =>
    string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const parts = text.trim().split(/\s+/);
  const suffixPattern = "[\\p{L}\\p{M}'’-]*"; // Allow unicode letters, accents, hyphen, apostrophe
  const pattern = parts
    .map((part) => escapeRegExp(part) + suffixPattern)
    .join('\\s+'); // Allow flexible whitespace between words

  const boundaryPrefix = '(^|[^\\p{L}\\p{N}_])';
  const boundarySuffix = '(?=$|[^\\p{L}\\p{N}_])';
  return new RegExp(`${boundaryPrefix}(${pattern})${boundarySuffix}`, 'giu');
};

// Helper to get examples as array
const getExamples = (card) => {
  if (Array.isArray(card.example_en)) {
    return card.example_en.length > 0 ? card.example_en : [''];
  }
  return [card.example_en || ''];
};

class ReviewSession {
  constructor(cards, mode, languageMode = 'en') {
    this.cards = cards; // Filtered list of cards
    this.mode = parseInt(mode); // 1, 2, 3, or 4
    this.languageMode = languageMode;
    this.currentIndex = 0;
    this.incorrectCardIds = new Set();
    this.isCardRevealed = false;
    this.modifiedCards = new Map(); // Store modified cards (id -> card)
    this.originalStats = new Map(); // Store original stats for revert (id -> stats)

    // Shuffle cards on init
    this.shuffleCards();
  }

  shuffleCards() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  getCurrentCard() {
    return this.cards[this.currentIndex];
  }

  hasNext() {
    return this.currentIndex < this.cards.length - 1;
  }

  next() {
    if (this.currentIndex < this.cards.length) {
      this.currentIndex++;
      this.isCardRevealed = false;
      return true;
    }
    return false;
  }

  // Returns HTML content based on mode and state
  renderCard() {
    const card = this.getCurrentCard();
    if (!card) return '<div class="flashcard">Error: No card</div>';
    const categoryBadge = '';

    switch (this.mode) {
      case 1: // EN -> ZH
      case 2: // ZH -> EN
        const front = this.mode === 1 ? card.word_en : card.meaning_zh;
        const back = this.mode === 1 ? card.meaning_zh : card.word_en;

        // Pick a random example and persist it for this card session
        if (
          !this.currentReviewSentence ||
          this.currentReviewCardId !== card.id
        ) {
          const examples = getExamples(card);
          this.currentReviewCardId = card.id;
          this.currentReviewSentence =
            examples[Math.floor(Math.random() * examples.length)];
        }

        return `
                    <div class="flashcard" id="active-flashcard">

                        ${categoryBadge}
                        <div class="content">${front}</div>
                        <div class="sub-content ${
                          this.isCardRevealed ? '' : 'hidden'
                        }">
                             <div class="meaning">${back}</div>
                             <div class="example">${
                               this.currentReviewSentence
                             }</div>
                        </div>
                        ${
                          !this.isCardRevealed
                            ? '<div class="hint">Click to flip</div>'
                            : ''
                        }
                    </div>
                `;
      case 3: // Spelling
        const spellingEx = getExamples(card)[0]; // Show first example context
        const answerLength = Math.max(
          String(card.word_en || '').trim().length,
          4,
        );
        if (this.isCardRevealed) {
          return `
                        <div class="flashcard">
                            ${categoryBadge}
                            <div class="review-question">${card.meaning_zh}</div>
                            <div class="review-answer-slot">
                              <input type="text" class="review-answer-field revealed" value="${card.word_en}" disabled size="${answerLength}" style="width:${answerLength}ch" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                            </div>
                        </div>
                    `;
        }
        return `
                    <div class="flashcard">
                        ${categoryBadge}
                        <div class="review-question">${card.meaning_zh}</div>
                        <div class="review-answer-slot">
                          <input type="text" class="review-answer-field" id="spelling-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" size="${answerLength}" style="width:${answerLength}ch">
                        </div>

                        <div id="spelling-feedback" class="feedback-msg"></div>
                    </div>
                `;
      case 4: // Cloze
        const word = card.word_en;
        const regex = createFlexibleRegex(word);

        if (!regex) {
          return `<div class="flashcard"><div class="content">Error: Invalid Word Content</div></div>`;
        }

        // Pick a random example that contains the word
        const allExamples = getExamples(card);
        // We prefer examples that actually match the word for Cloze
        const validExamples = allExamples.filter((ex) => {
          regex.lastIndex = 0;
          return regex.test(ex);
        });
        regex.lastIndex = 0; // Reset after filtering

        // If no example matches (rare), allow any (will just show text without blank)
        const candidates =
          validExamples.length > 0 ? validExamples : allExamples;

        if (!this.currentClozeSentence || this.currentClozeCardId !== card.id) {
          this.currentClozeCardId = card.id;
          this.currentClozeSentence =
            candidates[Math.floor(Math.random() * candidates.length)];
        }
        let sentence = this.currentClozeSentence;

        if (this.isCardRevealed) {
          return `
                       <div class="flashcard">
                           ${categoryBadge}
                           <div class="sub-content review-prompt">${
                             card.meaning_zh
                           }</div>
                           <div class="content cloze-content">${sentence.replace(
                             regex,
                             (fullMatch, prefix, matchWord) =>
                               `${prefix}<input type="text" class="cloze-input ${
                                 this.clozeRevealedByUnknown
                                   ? 'revealed'
                                   : 'error'
                               }" value="${matchWord}" disabled size="${Math.max(
                                 matchWord.length,
                                 4,
                               )}" style="width:${Math.max(matchWord.length, 4)}ch" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`,
                           )}</div>
                        </div>
                    `;
        }

        const hasMatch = regex.test(sentence);
        regex.lastIndex = 0; // Reset after test()

        return `
                    <div class="flashcard">
                        ${categoryBadge}
                        <div class="sub-content review-prompt">${
                          card.meaning_zh
                        }</div>
                        <div class="content cloze-content">
                            ${
                              hasMatch
                                ? sentence.replace(
                                    regex,
                                    (fullMatch, prefix, matchWord) =>
                                      `${prefix}<input type="text" class="cloze-input" id="cloze-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" size="${Math.max(
                                        matchWord.length,
                                        4,
                                      )}" style="width:${Math.max(matchWord.length, 4)}ch">`,
                                  )
                                : sentence +
                                  `<br><br><input type="text" class="cloze-input" id="cloze-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="" style="width:4ch">`
                            }
                        </div>
                        <div id="cloze-feedback" class="feedback-msg"></div>
                    </div>
                `;
      default:
        return 'Unknown Mode';
    }
  }
}

const ReviewManager = {
  session: null,

  start: (cards, mode, languageMode = 'en') => {
    if (cards.length === 0) {
      showPopup('Review Setup', '<p>No cards found for this selection!</p>');
      return;
    }
    ReviewManager.session = new ReviewSession(cards, mode, languageMode);

    showView('review-session');

    ReviewManager.updateUI();
  },

  updateUI: () => {
    try {
      const session = ReviewManager.session;
      if (!session) return;

      // Update Progress
      const progEl = $('#review-progress');
      if (progEl)
        progEl.textContent = `${session.currentIndex + 1} / ${
          session.cards.length
        }`;

      // Render Card
      const contentEl = $('#review-content');
      if (contentEl) contentEl.innerHTML = session.renderCard();

      // Bind events for dynamic content
      const flashcard = $('#active-flashcard');
      if (flashcard) {
        flashcard.onclick = () => ReviewManager.reveal();
      }

      const spellingInput = $('#spelling-input');
      if (spellingInput) {
        spellingInput.focus();
        spellingInput.onkeydown = (e) => {
          if (e.key === 'Enter') ReviewManager.checkSpelling();
        };
      }

      const clozeInput = $('#cloze-input');
      if (clozeInput) {
        clozeInput.focus();
        clozeInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            ReviewManager.checkCloze();
          }
        };
        clozeInput.oninput = () => {
          clozeInput.classList.remove('error');
        };
      }

      // Update Buttons
      const revealBtnContainer = $('#reveal-btn-container'); // Wrapper
      const revealBtn = $('#reveal-btn'); // Button for text
      const gradingBtns = $('#grading-btns');
      const selfAssessBtns = $('#self-assess-btns'); // NEW

      if (session.mode === 1 || session.mode === 2) {
        if (session.isCardRevealed) {
          revealBtnContainer.classList.add('hidden');
          gradingBtns.classList.add('hidden'); // We use selfAssessBtns instead
          selfAssessBtns.classList.remove('hidden');
        } else {
          revealBtnContainer.classList.add('hidden'); // No "I don't know" button, tap card to reveal
          gradingBtns.classList.add('hidden');
          selfAssessBtns.classList.add('hidden');
        }
      } else {
        // Modes 3 (Spelling) & 4 (Cloze) - Auto Graded
        selfAssessBtns.classList.add('hidden');

        if (session.isCardRevealed) {
          revealBtnContainer.classList.add('hidden');
          // Show Next Card button when revealed so user can proceed manually if needed
          gradingBtns.classList.remove('hidden');
        } else {
          revealBtn.textContent = "I don't know";
          revealBtnContainer.classList.remove('hidden');
          gradingBtns.classList.add('hidden');
        }
      }
    } catch (err) {
      console.error('Review Render Error:', err);
      showPopup(
        'Render Error',
        `<p>Something went wrong displaying this card.<br><small>${err.message}</small></p>`,
      );
    }
  },

  // Helper to backup stats before modification
  _backupStats: (card) => {
    const session = ReviewManager.session;
    if (session && !session.originalStats.has(card.id)) {
      // Deep copy stats
      session.originalStats.set(
        card.id,
        JSON.parse(JSON.stringify(card.review_stats || {})),
      );
    }
  },

  reveal: (isAuto = false) => {
    const session = ReviewManager.session;
    if (!session) return;

    // Backup before any modification
    ReviewManager._backupStats(session.getCurrentCard());

    // If it's a skip (I don't know) in Modes 3 or 4, record as wrong
    if (
      !isAuto &&
      (session.mode === 3 || session.mode === 4) &&
      !session.isCardRevealed
    ) {
      session.incorrectCardIds.add(session.getCurrentCard().id);
      const card = session.getCurrentCard();
      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      if (session.mode === 4) {
        session.clozeRevealedByUnknown = true;
      }

      // Local calculation (Optimistic/Batch)
      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        false,
        weight,
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);
    } else {
      session.clozeRevealedByUnknown = false;
    }

    session.isCardRevealed = true;
    ReviewManager.updateUI();
  },

  assess: (isCorrect) => {
    const session = ReviewManager.session;

    // Backup before modification
    ReviewManager._backupStats(session.getCurrentCard());

    // Track Stats
    if (!isCorrect) session.incorrectCardIds.add(session.getCurrentCard().id);

    const card = session.getCurrentCard();
    const modeKey = MODE_MAP[session.mode];
    const weight = MODE_WEIGHTS[session.mode];

    // Local calculation (Optimistic/Batch)
    const newStats = calculateNextReviewStats(
      card.review_stats,
      modeKey,
      isCorrect,
      weight,
    );
    card.review_stats = newStats;
    session.modifiedCards.set(card.id, card);

    // Move next
    ReviewManager.next();
  },

  next: () => {
    const session = ReviewManager.session;
    if (session.hasNext()) {
      session.next();
      session.clozeRevealedByUnknown = false;
      ReviewManager.updateUI();
    } else {
      ReviewManager.finish();
    }
  },

  finish: async () => {
    const session = ReviewManager.session;

    const forgotCount = session.incorrectCardIds.size;
    const totalCount = session.cards.length;
    const rememberedCount = totalCount - forgotCount;

    // 1. Update Score Display (Remembered / Total)
    $('#summary-correct').textContent = `${rememberedCount} / ${totalCount}`;

    // 2. Update Card Color (Green if all correct, Orange otherwise)
    const statusCard = $('#summary-status-card');
    if (statusCard) {
      if (forgotCount === 0) {
        statusCard.classList.remove('orange');
        statusCard.classList.add('green');
      } else {
        statusCard.classList.remove('green');
        statusCard.classList.add('orange');
      }
    }

    // 3. Render Forgotten Words List or Congratulations
    const forgottenContainer = $('#summary-forgotten-container');

    if (forgottenContainer) {
      if (forgotCount > 0) {
        // Render List Structure
        forgottenContainer.innerHTML = `
            <div class="card-label">Needs more review</div>
            <div id="summary-forgotten-list" class="summary-forgotten-text"></div>
        `;
        forgottenContainer.style.display = 'flex';
        forgottenContainer.style.justifyContent = 'flex-start';

        const listDiv = forgottenContainer.querySelector(
          '#summary-forgotten-list',
        );

        const forgottenWords = [];
        session.cards.forEach((card) => {
          if (session.incorrectCardIds.has(card.id)) {
            forgottenWords.push(card.word_en);
          }
        });

        if (listDiv) listDiv.textContent = forgottenWords.join(', ');
      } else {
        // Render Congratulations
        forgottenContainer.innerHTML = `
            <div class="summary-message">
                <h2>Well done!</h2>
            </div>
        `;
        forgottenContainer.style.display = 'flex';
        forgottenContainer.style.justifyContent = 'center';
      }
    }

    // Batch Save
    const cardsToSave = Array.from(session.modifiedCards.values());
    if (cardsToSave.length > 0) {
      try {
        await DataService.batchUpdateStats(cardsToSave, session.languageMode);
        // console.log("Batch sync successful");
      } catch (e) {
        console.error('Batch sync failed', e);
        showPopup(
          'Sync Error',
          '<p>Failed to save review progress. Please check connection.</p>',
        );
      }
    }

    showView('review-summary');

    ReviewManager.session = null;
  },

  checkSpelling: () => {
    const session = ReviewManager.session;
    const input = $('#spelling-input');
    const feedback = $('#spelling-feedback');
    const card = session.getCurrentCard();

    // Backup before modification
    ReviewManager._backupStats(card);

    if (normalize(input.value) === normalize(card.word_en)) {
      feedback.textContent = '';
      input.classList.add('correct');
      input.disabled = true;

      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        true,
        weight,
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);

      setTimeout(() => {
        ReviewManager.next();
      }, 700);
    } else {
      session.incorrectCardIds.add(card.id);
      feedback.textContent = '';
      input.classList.add('error');

      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        false,
        weight,
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);

      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);

      // Remove error when typing
      input.oninput = () => {
        input.classList.remove('error');
        input.oninput = null;
      };
    }
  },

  checkCloze: () => {
    const session = ReviewManager.session;
    const input = $('#cloze-input');
    const feedback = $('#cloze-feedback');
    const card = session.getCurrentCard();

    const word = normalize(card.word_en);
    const val = normalize(input.value);

    // Flexible matching: check against base word AND any variation found in the sentence
    const regex = createFlexibleRegex(card.word_en);
    // Use the currently displayed sentence for matching context if needed.
    // We must check against the specific sentence used in the cloze to find the correct variation (suffixed word)
    regex.lastIndex = 0;
    const matches = (session.currentClozeSentence.match(regex) || []).map((m) =>
      normalize(m),
    );

    // Backup before modification
    ReviewManager._backupStats(card);

    if (val === word || matches.includes(val)) {
      feedback.textContent = '';
      input.classList.remove('error');
      input.classList.add('correct');
      input.disabled = true;

      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        true,
        weight,
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);

      setTimeout(() => {
        ReviewManager.next();
      }, 1000);
    } else {
      session.incorrectCardIds.add(card.id);
      feedback.textContent = '';
      input.classList.add('error');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        false,
        weight,
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);

      // input.classList.add('shake');
      // setTimeout(() => input.classList.remove('shake'), 500);

      // Just color text
    }
  },

  // NEW: Cancel Session and Revert Changes
  cancel: () => {
    const session = ReviewManager.session;
    if (session) {
      console.log(
        'Cancelling session. Reverting ' +
          session.originalStats.size +
          ' cards.',
      );
      // Revert stats
      session.originalStats.forEach((originalStats, cardId) => {
        const card = session.cards.find((c) => c.id === cardId); // Or find in global App.allCards if we had ref
        // Since session.cards are references to objects in App.allCards (mostly), updating them here updates the app state.
        if (card) {
          card.review_stats = originalStats;
        }
      });
    }
    ReviewManager.session = null;
  },
};

export default ReviewManager;
