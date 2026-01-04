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

// Familiarity Calculator (Spec 5)
// Familiarity Calculator (Spec 5) - Updated for new state
export const calculateFamiliarity = (stats) => {
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
  // Base on score if state is not available
  const score = calculateFamiliarity(stats);
  if (score >= 0.75) return { label: 'Mastered', class: 'level-mastered' };
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
  const pattern = parts
    .map((part) => escapeRegExp(part) + '[a-z]*') // Allow suffix on each word
    .join('\\s+'); // Allow flexible whitespace between words

  return new RegExp(`\\b${pattern}\\b`, 'gi');
};

// Helper to get examples as array
const getExamples = (card) => {
  if (Array.isArray(card.example_en)) {
    return card.example_en.length > 0 ? card.example_en : [''];
  }
  return [card.example_en || ''];
};

class ReviewSession {
  constructor(cards, mode) {
    this.cards = cards; // Filtered list of cards
    this.mode = parseInt(mode); // 1, 2, 3, or 4
    this.currentIndex = 0;
    this.incorrectCardIds = new Set();
    this.isCardRevealed = false;
    this.modifiedCards = new Map(); // Store modified cards (id -> card)

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

    const level = getFamiliarityLevel(card.review_stats);

    const levelBadge = `<div class="level-badge ${level.class}">${level.label}</div>`;

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
                            ? '<div class="hint">(Click to flip)</div>'
                            : ''
                        }
                    </div>
                `;
      case 3: // Spelling
        const spellingEx = getExamples(card)[0]; // Show first example context
        if (this.isCardRevealed) {
          return `
                        <div class="flashcard">
                            <div class="sub-content" style="margin-bottom:1rem;">${card.meaning_zh}</div>
                            <div class="content">${card.word_en}</div>
                             <div class="sub-content"><small>${spellingEx}</small></div>
                        </div>
                    `;
        }
        return `
                    <div class="flashcard">
                        <div class="content">${card.meaning_zh}</div>
                        <input type="text" class="cloze-input" id="spelling-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" >
                         <div id="spelling-feedback" class="feedback-msg"></div>
                    </div>
                `;
      case 4: // Cloze
        const word = card.word_en;
        const regex = createFlexibleRegex(word);

        // Pick a random example that contains the word
        const allExamples = getExamples(card);
        // We prefer examples that actually match the word for Cloze
        const validExamples = allExamples.filter((ex) => regex.test(ex));
        regex.lastIndex = 0; // Reset

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
                           <div class="sub-content" style="margin-bottom:1rem;">${
                             card.meaning_zh
                           }</div>
                           <div class="content" style="font-size:1.5rem">${sentence.replace(
                             regex,
                             (match) =>
                               `<input type="text" class="cloze-input" value="${match}" disabled style="width:${match.length}ch; color:var(--danger-color); border-color:var(--danger-color); background:transparent;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`
                           )}</div>
                        </div>
                    `;
        }

        const hasMatch = regex.test(sentence);
        regex.lastIndex = 0; // Reset after test()

        return `
                    <div class="flashcard">
                        <div class="sub-content" style="margin-bottom:1rem;">${
                          card.meaning_zh
                        }</div>
                        <div class="content" style="font-size:1.5rem">
                            ${
                              hasMatch
                                ? sentence.replace(
                                    regex,
                                    (match) =>
                                      `<input type="text" class="cloze-input" id="cloze-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width:${match.length}ch" >`
                                  )
                                : sentence +
                                  `<br><br><input type="text" class="cloze-input" id="cloze-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Type word..." >`
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

  start: (cards, mode) => {
    if (cards.length === 0) {
      showPopup('Review Setup', '<p>No cards found for this selection!</p>');
      return;
    }
    ReviewManager.session = new ReviewSession(cards, mode);

    showView('review-session');

    ReviewManager.updateUI();
  },

  updateUI: () => {
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
        if (e.key === 'Enter') ReviewManager.checkCloze();
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
      if (session.isCardRevealed) {
        revealBtnContainer.classList.add('hidden');
        gradingBtns.classList.remove('hidden');
        selfAssessBtns.classList.add('hidden');
      } else {
        revealBtn.textContent = "I don't know";
        revealBtnContainer.classList.remove('hidden');
        gradingBtns.classList.add('hidden');
        selfAssessBtns.classList.add('hidden');
      }
    }
  },

  reveal: (isAuto = false) => {
    const session = ReviewManager.session;
    if (!session) return;

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

      // Local calculation (Optimistic/Batch)
      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        false,
        weight
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);
    }

    session.isCardRevealed = true;
    ReviewManager.updateUI();
  },

  assess: (isCorrect) => {
    const session = ReviewManager.session;

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
      weight
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
      ReviewManager.updateUI();
    } else {
      ReviewManager.finish();
    }
  },

  finish: async () => {
    const session = ReviewManager.session;
    $('#summary-total').textContent = session.cards.length;

    const forgotCount = session.incorrectCardIds.size;
    const rememberedCount = session.cards.length - forgotCount;

    // Update Breakdown
    $('#summary-correct').textContent = rememberedCount;
    $('#summary-wrong').textContent = forgotCount;

    // Batch Save
    const cardsToSave = Array.from(session.modifiedCards.values());
    if (cardsToSave.length > 0) {
      // We do this in background or await?
      // To be safe and ensure data persistence, lets trigger it.
      // If we want it fast, we can don't await, but user might exit app.
      // Let's await it but show a non-blocking toast?
      // Or show popup "Partial success" etc if fail?

      try {
        await DataService.batchUpdateStats(cardsToSave);
        // console.log("Batch sync successful");
      } catch (e) {
        console.error('Batch sync failed', e);
        showPopup(
          'Sync Error',
          '<p>Failed to save review progress. Please check connection.</p>'
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

    if (normalize(input.value) === normalize(card.word_en)) {
      feedback.textContent = 'Correct!';
      feedback.className = 'feedback-msg correct';
      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        true,
        weight
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);

      setTimeout(() => {
        ReviewManager.reveal(true);
      }, 500);
    } else {
      session.incorrectCardIds.add(card.id);
      feedback.textContent = 'Try again!';
      feedback.className = 'feedback-msg incorrect';
      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        false,
        weight
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);

      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
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
    const matches = (session.currentClozeSentence.match(regex) || []).map((m) =>
      normalize(m)
    );

    if (val === word || matches.includes(val)) {
      feedback.textContent = ''; // UI feedback via color is enough, cleaner
      input.classList.add('correct');
      // input.disabled = true; // Prevent further typing (Fixed syntax from previous edit)
      const el = input;
      el.disabled = true;

      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        true,
        weight
      );
      card.review_stats = newStats;
      session.modifiedCards.set(card.id, card);

      setTimeout(() => {
        ReviewManager.next();
      }, 700);
    } else {
      // Turn text red, no feedback text
      session.incorrectCardIds.add(card.id);
      feedback.textContent = '';
      input.classList.add('error');

      const modeKey = MODE_MAP[session.mode];
      const weight = MODE_WEIGHTS[session.mode];

      const newStats = calculateNextReviewStats(
        card.review_stats,
        modeKey,
        false,
        weight
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
};

export default ReviewManager;
