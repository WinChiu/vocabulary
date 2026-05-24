// Main App Logic (ES Module)
import DataService from './data.js?v=4.1';
import {
  getLanguageConfig,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguageMode,
} from './language.js?v=4.1';
import {
  createAuthBypassUser,
  shouldBypassAuthForTesting,
} from './auth-flow.js?v=4.1';
import {
  buildCategoryOptions,
  categoryMatchesFilter,
  normalizeCategory,
  UNCATEGORIZED_FILTER_VALUE,
} from './category.js?v=4.1';
import {
  createVocabularyCard,
  createVocabularyTableRow,
  escapeHtml,
  renderEmptyState,
  renderExampleInput,
  renderImportPreviewItem,
  renderPreviewPage,
  renderPreviewSection,
  renderVocabularyTableShell,
} from './components.js?v=4.1';
import ReviewManager, {
  calculateFamiliarity,
  getFamiliarityLevel,
} from './review.js?v=4.1';
import { playPronunciation } from './tts.js?v=4.1';
import {
  $,
  $$,
  on,
  showView,
  showPopup,
  closeModal,
  showLoading,
  hideLoading,
} from './utils.js?v=4.1';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

const App = {
  allCards: [],
  currentPage: 1, // Pagination State
  userInfo: null,
  isMockMode: false,
  editingCardId: null, // Track editing state
  currentPreviewId: null, // Track current preview card
  currentLanguageMode: normalizeLanguageMode(
    localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en',
  ),

  getLanguageConfig: () => getLanguageConfig(App.currentLanguageMode),

  getControlValue: (selector, fallback = '') => {
    const el = typeof selector === 'string' ? $(selector) : selector;
    return el && typeof el.value !== 'undefined' ? el.value : fallback;
  },

  setControlValue: (selector, value = '') => {
    const el = typeof selector === 'string' ? $(selector) : selector;
    if (el && typeof el.value !== 'undefined') el.value = value;
  },

  getControlChecked: (selector) => {
    const el = typeof selector === 'string' ? $(selector) : selector;
    if (!el) return false;
    if (typeof el.selected !== 'undefined') return Boolean(el.selected);
    if (typeof el.checked !== 'undefined') return Boolean(el.checked);
    return false;
  },

  setControlChecked: (selector, checked) => {
    const el = typeof selector === 'string' ? $(selector) : selector;
    if (!el) return;
    if (typeof el.selected !== 'undefined') el.selected = checked;
    if (typeof el.checked !== 'undefined') el.checked = checked;
    el.toggleAttribute('selected', Boolean(checked));
    el.toggleAttribute('checked', Boolean(checked));
  },

  renderCategoryOptions: () => {
    const categoryOptions = buildCategoryOptions(App.allCards);
    const selects = [$('#filter-category'), $('#review-category')].filter(
      Boolean,
    );

    selects.forEach((select) => {
      const previousValue = App.getControlValue(select, 'all');
      const isNativeSelect = select.tagName.toLowerCase() === 'select';
      select.innerHTML = isNativeSelect
        ? `
          <option value="all" selected>${select.id === 'filter-category' ? 'All' : 'All Categories'}</option>
          <option value="${UNCATEGORIZED_FILTER_VALUE}">Uncategorized</option>
          ${categoryOptions
            .map(
              (category) => `<option value="${category}">${category}</option>`,
            )
            .join('')}
        `
        : `
          <md-select-option value="all" selected>
            <div slot="headline">All</div>
          </md-select-option>
          <md-select-option value="${UNCATEGORIZED_FILTER_VALUE}">
            <div slot="headline">Uncategorized</div>
          </md-select-option>
          ${categoryOptions
            .map(
              (category) => `
                <md-select-option value="${category}">
                  <div slot="headline">${category}</div>
                </md-select-option>
              `,
            )
            .join('')}
        `;

      const validValues = new Set([
        'all',
        UNCATEGORIZED_FILTER_VALUE,
        ...categoryOptions,
      ]);
      App.setControlValue(
        select,
        validValues.has(previousValue) ? previousValue : 'all',
      );
    });
  },

  getSelectedReviewMode: () => {
    const selected = Array.from($$('.mode-option')).find((el) =>
      el.classList.contains('active'),
    );
    return selected ? selected.dataset.value : '1';
  },

  setSelectedReviewMode: (mode) => {
    $$('.mode-option').forEach((el) => {
      const isSelected = el.dataset.value === String(mode);
      el.classList.toggle('active', isSelected);
    });
  },

  setButtonText: (selector, text) => {
    const el = typeof selector === 'string' ? $(selector) : selector;
    if (el) el.textContent = text;
  },

  applyLanguageCopy: () => {
    const config = App.getLanguageConfig();

    document.body.dataset.languageMode = config.mode;
    DataService.setLanguageMode(config.mode);

    $$('.language-mode-option').forEach((btn) => {
      const isActive = btn.dataset.languageMode === config.mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    const sourceLabel = $('#source-word-label');
    if (sourceLabel) sourceLabel.textContent = config.sourceLabel;

    const sourceInput = $('#word_en');
    if (sourceInput) {
      sourceInput.placeholder = config.sourcePlaceholder;
    }

    const examplesLabel = $('#examples-field-label');
    if (examplesLabel) examplesLabel.textContent = config.exampleLabel;

    const addExampleBtn = $('#add-example-btn');
    if (addExampleBtn) {
      const icon = addExampleBtn.querySelector('md-icon');
      addExampleBtn.textContent = config.addExampleActionLabel;
      if (icon) addExampleBtn.prepend(icon);
    }

    const exampleInputs = $$('.example-input');
    exampleInputs.forEach((input) => {
      input.placeholder = config.examplePlaceholder;
    });

    const searchInput = $('#search-input');
    if (searchInput) searchInput.label = config.searchPlaceholder;

    const importTitle = $('#import-title');
    if (importTitle) importTitle.textContent = config.importTitle;

    const modeFlipSource = $('#mode-flip-source-label');
    if (modeFlipSource) modeFlipSource.textContent = '單字卡';

    if (!App.editingCardId) {
      const addTitle = $('#add-card .view-header-flex h1');
      if (addTitle) addTitle.textContent = config.addTitle;
      const submitBtn = $('#save-card-btn');
      if (submitBtn && submitBtn.textContent !== 'Saving...') {
        submitBtn.textContent = config.saveActionLabel;
      }
    }
  },

  switchLanguageMode: async (mode) => {
    const nextMode = normalizeLanguageMode(mode);
    if (nextMode === App.currentLanguageMode) return;

    if (ReviewManager.session) {
      showPopup(
        'Review in Progress',
        '<p>Please exit the current review session before switching language mode.</p>',
      );
      App.applyLanguageCopy();
      return;
    }

    const activeView = Array.from($$('.view')).find((view) =>
      view.classList.contains('active'),
    );
    const activeViewId = activeView ? activeView.id : 'dashboard';
    const shouldStay = activeViewId === 'dashboard' || activeViewId === 'words';

    App.currentLanguageMode = nextMode;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextMode);
    App.currentPage = 1;
    App.currentPreviewId = null;
    App.editingCardId = null;
    App.applyLanguageCopy();

    if (App.userInfo) {
      await App.refreshData();
      showView(shouldStay ? activeViewId : 'dashboard');
    }
  },

  // Animation Helper
  countUp: (el, start, end, duration) => {
    if (!el) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Ease-in-Out Cubic
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      el.textContent = Math.floor(ease * (end - start) + start);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = end;
      }
    };
    window.requestAnimationFrame(step);
  },

  // UI Helpers for Examples
  addExampleInput: (value = '') => {
    const container = $('#examples-container');
    const config = App.getLanguageConfig();
    const inputs = container.querySelectorAll('.example-row');
    if (inputs.length >= 5) {
      showPopup(
        'Limit Reached',
        'You can include at most 5 example sentences.',
      );
      return;
    }

    const div = document.createElement('div');
    div.className = 'example-row';
    div.innerHTML = renderExampleInput(config.examplePlaceholder);

    container.appendChild(div);
    const field = div.querySelector('.example-input');
    if (field) field.value = value;
    App.updateExampleButtons();
  },

  updateExampleButtons: () => {
    const container = $('#examples-container');
    const rows = container.querySelectorAll('.example-row');
    const addBtn = $('#add-example-btn');

    // Hide/Show Add Button
    if (addBtn) addBtn.style.display = rows.length >= 5 ? 'none' : 'flex';

    // Handle Remove Buttons
    rows.forEach((row, index) => {
      const btn = row.querySelector('.btn-remove-example');
      if (btn) {
        // If only one row, hide remove button to enforce "at least one"
        btn.style.display = rows.length === 1 ? 'none' : 'block';
      }
    });
  },

  prepareAddCardForm: () => {
    const config = App.getLanguageConfig();
    $('#add-card-form').reset();
    App.setControlValue('#word_en', '');
    App.setControlValue('#meaning_zh', '');
    App.setControlValue('#category', '');
    App.setControlValue('#note', '');
    App.setControlChecked('#is_starred', false);
    $('#examples-container').innerHTML = '';
    App.addExampleInput();

    App.editingCardId = null;
    $('#add-card .view-header-flex h1').textContent = config.addTitle;
    App.setButtonText('#save-card-btn', config.saveActionLabel);
    App.applyLanguageCopy();
  },

  prepareImportView: () => {
    $('#import-preview').classList.add('hidden');
    $('#import-file-section').classList.remove('hidden');
    $('#csv-file-input').value = '';
  },
  init: async () => {
    App.applyLanguageCopy();
    App.bindEvents();

    App.isMockMode = shouldBypassAuthForTesting(window.location.search);
    DataService.setMockMode(App.isMockMode);

    if (App.isMockMode) {
      App.userInfo = createAuthBypassUser();
      showView('dashboard');
      await App.refreshData();
      return;
    }

    const auth = getAuth();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    const enterDashboard = async (user) => {
      App.userInfo = user;
      showView('dashboard');
      await App.refreshData();
    };

    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
      console.error('Failed to set auth persistence', error);
    }

    try {
      const redirectResult = await getRedirectResult(auth);
      if (redirectResult?.user) {
        await enterDashboard(redirectResult.user);
        return;
      }
    } catch (error) {
      console.error('Redirect result failed', error);
    }

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await enterDashboard(user);
      } else {
        showView('login');
      }
    });

    const loginBtn = $('#google-login-btn');
    if (loginBtn) {
      on(loginBtn, 'click', async () => {
        try {
          await setPersistence(auth, browserLocalPersistence);

          const result = await signInWithPopup(auth, provider);

          if (result?.user) {
            await enterDashboard(result.user);
          }
        } catch (popupError) {
          console.warn('Popup login failed, fallback to redirect', popupError);

          try {
            await signInWithRedirect(auth, provider);
          } catch (redirectError) {
            console.error('Redirect login failed', redirectError);
            showPopup('Login Error', `<p>${redirectError.message}</p>`);
          }
        }
      });
    }
  },

  refreshData: async () => {
    DataService.setLanguageMode(App.currentLanguageMode);
    // Show loading covering the entire workspace (including navbar)
    const workspace = document.querySelector('.main-workspace');
    if (workspace) {
      showLoading('.main-workspace');
    }

    // Hide Navigation & FABs during load (User Request)
    const bottomNav = $('#bottom-nav-container');
    if (bottomNav) bottomNav.classList.add('hidden');

    try {
      const cards = await DataService.fetchCards(App.currentLanguageMode);
      App.allCards = cards;
      App.currentPage = 1; // Reset to page 1 on full refresh
      App.renderCategoryOptions();
      App.renderDashboard();
    } catch (e) {
      console.error('Failed to refresh data', e);

      // Handle Permission Denied (e.g., wrong email)
      if (e.code === 'permission-denied' || e.message.includes('permission')) {
        const auth = getAuth();
        const email = App.userInfo ? App.userInfo.email : 'Unknown Account';
        await signOut(auth);
        showPopup(
          'Access Denied',
          `<p>The account <b>${email}</b> is not authorized to access this database.</p><p class="modal-note">Server Rejected Request.</p>`,
        );
        showView('login');
        return;
      }

      showPopup(
        'Network Error',
        `<p>Could not load cards. Details: <br><b>${e.message}</b></p>`,
      );
    } finally {
      if (workspace) {
        hideLoading('.main-workspace');
      }
      // Restore Navigation & FABs
      if (bottomNav) bottomNav.classList.remove('hidden');
    }
  },

  updateDueCount: () => {
    const scope = App.getControlValue('#review-scope', 'all'); // 'all' or 'starred'
    const statusFilter = App.getControlValue('#review-status', 'all'); // 'all', 'new', 'learning', 'mastered'
    const typeFilter = App.getControlValue('#review-setup-type', 'word'); // 'word' or 'phrase'
    const categoryFilter = App.getControlValue('#review-category', 'all');
    const now = new Date();

    let baseCards = [...App.allCards];

    // Filter by Scope
    if (scope === 'starred') {
      baseCards = baseCards.filter((c) => c.is_starred);
    }

    // Filter by Status
    if (statusFilter !== 'all') {
      baseCards = baseCards.filter((c) => {
        const level = getFamiliarityLevel(c.review_stats);
        return level.label.toLowerCase() === statusFilter;
      });
    }

    // Filter by Type
    if (typeFilter !== 'all') {
      baseCards = baseCards.filter((c) => {
        const isPhrase = c.word_en.trim().split(/\s+/).length > 1;
        return typeFilter === 'phrase' ? isPhrase : !isPhrase;
      });
    }

    baseCards = baseCards.filter((c) =>
      categoryMatchesFilter(c, categoryFilter),
    );

    // special UI handling for NEW status
    const dueCheckbox = $('#review-due-only');
    const dueLabel = dueCheckbox
      ? dueCheckbox.closest('.checkbox-wrapper')
      : null;

    if (dueCheckbox && dueLabel) {
      if (statusFilter === 'new') {
        dueCheckbox.disabled = true;
        dueLabel.style.opacity = '0.5';
        dueLabel.title = 'New cards do not have due dates';
      } else {
        dueCheckbox.disabled = false;
        dueLabel.style.opacity = '1';
        dueLabel.title = '';
      }
    }

    const dueCards = baseCards.filter((card) => {
      const stats = card.review_stats || {}; // Ensure object exists
      const state = stats.state || 'NEW';

      // Special Case: If Status is specifically "NEW", we count NEW cards
      // regardless of "Due" logic (since New cards are always available if filtered)
      // BUT the badge says "Due Only - N cards". Use standard logic:
      // If "Due Only" checkbox is checked, we usually exclude New.
      // However, the function goal is to show count for "Due Only" label.
      // If user selected "New", "Due Only" is conceptually moot or means "All New".
      if (statusFilter === 'new') {
        return state === 'NEW';
      }

      // Exclude NEW cards from standard Due Count
      if (state === 'NEW') return false;

      if (!stats || !stats.next_review_date) return true; // Fallback for data inconsistency if state != NEW

      const nextDate = stats.next_review_date.toDate
        ? stats.next_review_date.toDate()
        : new Date(stats.next_review_date);

      return nextDate <= now;
    });

    const badge = $('#due-count-badge');
    if (badge) {
      badge.textContent = dueCards.length;
    }
  },

  bindEvents: () => {
    $$('.language-mode-option').forEach((btn) => {
      on(btn, 'click', () => {
        App.switchLanguageMode(btn.dataset.languageMode);
        const languageMenu = btn.closest('.dashboard-language-menu');
        if (languageMenu) {
          languageMenu.classList.remove('is-open');
          const trigger = languageMenu.querySelector('#dashboard-language-btn');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
      });
    });

    const dashboardLanguageMenu = $('.dashboard-language-menu');
    const dashboardLanguageBtn = $('#dashboard-language-btn');
    on(dashboardLanguageBtn, 'click', (event) => {
      event.stopPropagation();
      if (!dashboardLanguageMenu) return;
      const isOpen = dashboardLanguageMenu.classList.toggle('is-open');
      dashboardLanguageBtn.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', (event) => {
      if (
        dashboardLanguageMenu &&
        !dashboardLanguageMenu.contains(event.target)
      ) {
        dashboardLanguageMenu.classList.remove('is-open');
        if (dashboardLanguageBtn) {
          dashboardLanguageBtn.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Global Keydown Listener for Review Navigation
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;

      // Ensure Review Session is Active
      const reviewView = $('#review-session');
      if (!reviewView || !reviewView.classList.contains('active')) return;

      // Ensure NO Modal is Open (prevent accidental skips when confirming exit)
      const dialog = $('#modal-dialog');
      if (dialog && dialog.open) {
        return;
      }

      const session = ReviewManager.session;
      if (!session) return;

      // Only for Spelling (3) and Cloze (4)
      if (session.mode === 3 || session.mode === 4) {
        // "Enter" represents "Next Card" ONLY if card is already revealed
        if (session.isCardRevealed) {
          e.preventDefault();
          ReviewManager.next();
        }
      }
    });

    const handleNavigationTarget = (target) => {
      if (!target) return;

      // Reset Import View State
      if (target === 'import') {
        App.prepareImportView();
      }

      if (target === 'add-card') {
        App.prepareAddCardForm();
      }

      if (target === 'dashboard' || target === 'words') {
        App.renderDashboard();
      }

      if (target === 'review-setup') {
        // Reset scope to 'all' on enter or handle based on current selection
        App.updateDueCount();
      }

      showView(target);
    };

    // Navigation Interception
    $$('.nav-btn').forEach((btn) => {
      on(btn, 'click', () => {
        handleNavigationTarget(btn.getAttribute('data-target'));
      });
    });

    on($('#bottom-nav-container'), 'click', (event) => {
      const navItem = event.target.closest('.nav-item');
      if (!navItem) return;
      handleNavigationTarget(navItem.getAttribute('data-target'));
    });

    const wordsAddBtn = $('#words-add-btn');

    if (wordsAddBtn) {
      on(wordsAddBtn, 'click', () => {
        App.prepareAddCardForm();
        showView('add-card');
      });
    }

    const wordsView = $('#words');
    const wordsFilterBtn = $('#words-filter-btn');
    const wordsFilterCloseBtn = $('#words-filter-close-btn');
    const closeWordsFilters = () => {
      if (!wordsView) return;
      wordsView.classList.remove('filters-open');
      if (wordsFilterBtn) wordsFilterBtn.setAttribute('aria-expanded', 'false');
    };
    const openWordsFilters = () => {
      if (!wordsView) return;
      wordsView.classList.add('filters-open');
      if (wordsFilterBtn) wordsFilterBtn.setAttribute('aria-expanded', 'true');
    };

    on(wordsFilterBtn, 'click', openWordsFilters);
    on(wordsFilterCloseBtn, 'click', closeWordsFilters);
    on(wordsView, 'click', (event) => {
      if (
        event.target === wordsView &&
        wordsView.classList.contains('filters-open')
      ) {
        closeWordsFilters();
      }
    });

    $$('.dashboard-menu-item').forEach((item) => {
      on(item, 'click', () => {
        const target = item.dataset.dashboardTarget;
        const action = item.dataset.dashboardAction;

        if (target === 'review-setup') {
          App.updateDueCount();
          showView('review-setup');
          return;
        }

        if (target === 'import') {
          App.prepareImportView();
          showView('import');
          return;
        }

        if (target === 'words') {
          App.setControlChecked('#filter-starred-only', false);
          App.currentPage = 1;
          App.renderDashboard();
          showView('words');
          return;
        }

        if (action === 'starred') {
          App.setControlChecked('#filter-starred-only', true);
          App.currentPage = 1;
          App.renderDashboard();
          showView('words');
        }
      });
    });

    const btnBackAddCard = $('#btn-back-add-card');
    if (btnBackAddCard) {
      on(btnBackAddCard, 'click', () => {
        // Reset form
        $('#add-card-form').reset();
        // Return to Words view
        showView('words');
      });
    }

    const btnBackImport = $('#btn-back-import');
    if (btnBackImport) {
      on(btnBackImport, 'click', () => {
        // Reset Input
        $('#csv-file-input').value = '';
        // Return to Words view
        showView('words');
      });
    }

    const btnBackReviewSetup = $('#btn-back-review-setup');
    if (btnBackReviewSetup) {
      on(btnBackReviewSetup, 'click', () => {
        // Return to Dashboard (standard back from Review Setup started from dashboard)
        showView('dashboard');
      });
    }

    // Handle Review Scope Filter Change
    on($('#review-scope'), 'change', () => {
      App.updateDueCount();
    });

    // Handle Review Status Filter Change (For Due Count Update)
    on($('#review-status'), 'change', () => {
      App.updateDueCount();
    });

    on($('#review-category'), 'change', () => {
      App.updateDueCount();
    });

    // Handle Review Type Change (Disable Cloze for Phrases + Update Due Count)
    const reviewTypeSelect = $('#review-setup-type');
    if (reviewTypeSelect) {
      on(reviewTypeSelect, 'change', () => {
        // 1. Update Due Count
        App.updateDueCount();

        // 2. Cloze Logic
        const isPhrase = App.getControlValue(reviewTypeSelect) === 'phrase';
        const clozeLabel = $('#grade-mode-cloze');
        if (!clozeLabel) return;

        if (isPhrase) {
          clozeLabel.style.opacity = '0.5';
          clozeLabel.style.pointerEvents = 'none';
          if (clozeLabel.classList.contains('active')) {
            // Switch to Flip EN if Cloze was selected
            App.setSelectedReviewMode('1');
          }
        } else {
          clozeLabel.style.opacity = '1';
          clozeLabel.style.pointerEvents = 'auto';
        }
      });
    }

    // Pagination Listeners
    on($('#prev-page-btn'), 'click', () => {
      if (App.currentPage > 1) {
        App.currentPage--;
        App.renderDashboard();
      }
    });

    on($('#next-page-btn'), 'click', () => {
      // Logic handled in render to check max pages, but safe to just increment and let render handle bounds if we wanted,
      // but better to check bounds. We'll rely on button disabled state mostly, but add safety check.
      const totalPages = Math.ceil(App.lastFilteredCount / 15); // We need to store this or recalculate
      if (App.currentPage < totalPages) {
        App.currentPage++;
        App.renderDashboard();
      }
    });

    // Reset Page on Filter Changes
    const resetPage = () => {
      App.currentPage = 1;
      App.renderDashboard();
    };
    on($('#filter-starred-only'), 'change', resetPage);
    on($('#search-input'), 'input', resetPage);
    on($('#filter-status'), 'change', resetPage);
    on($('#filter-type'), 'change', resetPage);
    on($('#filter-category'), 'change', resetPage);

    $$('.mode-option').forEach((option) => {
      on(option, 'click', () => {
        const radio = option.querySelector('md-radio');
        if (radio && !option.style.pointerEvents) {
          App.setSelectedReviewMode(radio.value);
        }
      });
    });

    // Cancel buttons
    $$('.cancel-nav').forEach((btn) => {
      on(btn, 'click', () => showView('dashboard'));
    });

    // Add Card Form
    on($('#add-card-form'), 'submit', async (e) => {
      e.preventDefault();
      const config = App.getLanguageConfig();
      const btn = $('#save-card-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      // Collect Examples
      const exampleInputs = $$('.example-input');
      const examples = Array.from(exampleInputs)
        .map((input) => input.value.trim())
        .filter((text) => text.length > 0);

      const card = {
        word_en: App.getControlValue('#word_en').trim(),
        meaning_zh: App.getControlValue('#meaning_zh').trim(),
        category: normalizeCategory(App.getControlValue('#category')),
        note: App.getControlValue('#note').trim(),
        example_en: examples.length > 0 ? examples : [], // Data service will validate or we rely on required input
        is_starred: App.getControlChecked('#is_starred'),
      };

      if (!card.word_en || !card.meaning_zh) {
        showPopup(
          'Missing Info',
          '<p>Please enter both the word and meaning.</p>',
        );
        btn.disabled = false;
        btn.textContent = App.editingCardId
          ? config.updateActionLabel
          : config.saveActionLabel;
        return;
      }

      if (card.example_en.length === 0) {
        showPopup(
          'Missing Info',
          `<p>Please add at least one ${config.exampleLabel
            .toLowerCase()
            .replace(/s$/, '')}.</p>`,
        );
        btn.disabled = false;
        btn.textContent = App.editingCardId
          ? config.updateActionLabel
          : config.saveActionLabel;
        return;
      }

      // Duplicate Check (Case-insensitive)
      const isDuplicate = App.allCards.some((c) => {
        if (App.editingCardId && c.id === App.editingCardId) return false;
        return c.word_en.toLowerCase() === card.word_en.toLowerCase();
      });

      if (isDuplicate) {
        showPopup(
          `Duplicate ${config.sourceLabel}`,
          `<p>The word "<b>${card.word_en}</b>" is already in your vocabulary list.</p>`,
          true,
        );
        btn.disabled = false;
        btn.textContent = App.editingCardId
          ? config.updateActionLabel
          : config.saveActionLabel;
        return;
      }

      try {
        if (App.editingCardId) {
          // Update Existing Card
          await DataService.updateCard(
            App.editingCardId,
            card,
            App.currentLanguageMode,
          );
          showPopup('Updated!', '<p>Card updated successfully.</p>', true);
        } else {
          // Add New Card
          await DataService.addCard(card, App.currentLanguageMode);
          showPopup(
            'Saved!',
            '<p>New vocabulary card added successfully.</p>',
            true,
          );
        }

        e.target.reset();
        App.setControlValue('#note', '');
        App.setControlValue('#category', '');
        $('#examples-container').innerHTML = ''; // Clear inputs
        App.addExampleInput(); // Add one fresh input
        App.editingCardId = null; // Reset state
        $('#add-card .view-header-flex h1').textContent = config.addTitle; // Reset Title

        await App.refreshData(); // Refresh list
        showView('dashboard');
      } catch (err) {
        showPopup('Error', `<p>${err.message}</p>`);
      } finally {
        btn.disabled = false;
        btn.textContent = App.editingCardId
          ? config.updateActionLabel
          : config.saveActionLabel;
      }
    });

    on($('#filter-starred-only'), 'change', () => {
      App.currentPage = 1; // Reset to first page on filter change
      App.renderDashboard();
    });

    on($('#search-input'), 'input', () => {
      App.currentPage = 1;
      App.renderDashboard();
    });

    on($('#filter-status'), 'change', () => {
      App.currentPage = 1;
      App.renderDashboard();
    });

    // CARD LIST EVENT DELEGATION (New)
    const listContainer = $('#card-list-modern');
    if (listContainer) {
      on(listContainer, 'click', (e) => {
        // 1. Handle Action Buttons (Star, Delete)
        const btn = e.target.closest('button, md-icon-button');
        if (btn) {
          const itemEl = btn.closest('.vocab-row, .vocab-card-modern');
          if (!itemEl) return;
          const id = itemEl.dataset.id;

          if (btn.classList.contains('btn-star')) {
            const isStarred = btn.dataset.starred === 'true';
            App.toggleStar(id, isStarred);
          } else if (btn.classList.contains('btn-delete')) {
            App.handleDelete(id);
          } else if (btn.classList.contains('btn-edit')) {
            App.handleEdit(id);
          }
          return;
        }

        // 2. Ignore Checkbox interactions (if any)
        if (e.target.closest('.checkbox-col')) {
          return;
        }

        // 3. Handle Preview Click (bubble up) - Anywhere else in the row or card
        const item = e.target.closest('.vocab-row, .vocab-card-modern');
        if (item) {
          const id = item.dataset.id;
          App.showCardPreview(id);
        }
      });
    }

    // Event Delegation for Examples
    if (document.querySelector('#examples-container')) {
      on($('#examples-container'), 'click', (e) => {
        const btn = e.target.closest('.btn-remove-example');
        if (btn) {
          const row = btn.closest('.example-row');
          row.remove();
          App.updateExampleButtons();
        }
      });
    }

    const addExBtn = $('#add-example-btn');
    if (addExBtn) {
      on(addExBtn, 'click', () => {
        App.addExampleInput();
      });
    }

    // Start Review Button (Global, e.g. in FAB now)
    on($('#start-review-action'), 'click', (e) => {
      e.stopPropagation();
      if (e.currentTarget.disabled) return;
      showView('review-setup');
      App.updateDueCount();
    });
    on($('#card-due-container'), 'click', () => {
      if ($('#start-review-action')?.disabled) return;
      showView('review-setup');
      App.updateDueCount();
    });

    // Mode Selection Click Handlers
    $$('.mode-option').forEach((el) => {
      on(el, 'click', () => {
        $$('.mode-option').forEach((opt) => opt.classList.remove('active'));
        el.classList.add('active');
      });
    });

    // Review Setup Start
    on($('#review-setup-form'), 'submit', (e) => {
      e.preventDefault();
      const scope = App.getControlValue('#review-scope', 'all');
      const mode = App.getSelectedReviewMode();
      const limit = parseInt(App.getControlValue('#review-limit', '10'), 10);

      const dueOnly = App.getControlChecked('#review-due-only');
      const type = App.getControlValue('#review-setup-type', 'word');
      const status = App.getControlValue('#review-status', 'all');
      const category = App.getControlValue('#review-category', 'all');

      let cardsToReview = [...App.allCards];

      // Status Filter
      if (status !== 'all') {
        cardsToReview = cardsToReview.filter((c) => {
          // Use shared helper to match UI label logic (handles legacy data missing 'state')
          const currentLevel = getFamiliarityLevel(c.review_stats);
          return currentLevel.label.toLowerCase() === status;
        });
      }

      // Type Filter
      if (type !== 'all') {
        cardsToReview = cardsToReview.filter((c) => {
          const isPhrase = c.word_en.trim().split(/\s+/).length > 1;
          return type === 'phrase' ? isPhrase : !isPhrase;
        });
      }

      if (scope === 'starred') {
        cardsToReview = cardsToReview.filter((c) => c.is_starred);
      }

      cardsToReview = cardsToReview.filter((c) =>
        categoryMatchesFilter(c, category),
      );

      // SRS Filtering: Only include DUE cards if toggle is ON
      // Exception: If user explicitly selects "New", we ignore Due limit (since New cards aren't "Due")
      if (dueOnly && status !== 'new') {
        const now = new Date();
        cardsToReview = cardsToReview.filter((card) => {
          const stats = card.review_stats || {};
          const state = stats.state || 'NEW';

          // Exclude NEW cards from Due Only review
          if (state === 'NEW') return false;

          if (!stats.next_review_date) return true; // Should be covered by NEW check, but safeguard

          const nextDate = stats.next_review_date.toDate
            ? stats.next_review_date.toDate()
            : new Date(stats.next_review_date);

          return nextDate <= now;
        });
      }

      if (cardsToReview.length === 0) {
        showPopup('Review Setup', 'No cards found for this selection!');
        return;
      }

      // Shuffle before limits (Fisher-Yates)
      for (let i = cardsToReview.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardsToReview[i], cardsToReview[j]] = [
          cardsToReview[j],
          cardsToReview[i],
        ];
      }

      // Apply Limit
      cardsToReview = cardsToReview.slice(0, limit);

      ReviewManager.start(cardsToReview, mode, App.currentLanguageMode);
    });

    // Bento Popup Overrides
    // Bento Popup Overrides
    window.alert = (msg) => showPopup('Notification', `<p>${msg}</p>`);

    // Import Logic
    const fileInput = $('#csv-file-input');
    let pendingImportData = [];

    on(fileInput, 'change', (e) => {
      const file = e.target.files[0];
      const confirmBtn = $('#confirm-import-btn');

      if (!file) {
        if (confirmBtn) confirmBtn.disabled = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target.result;
        try {
          const workbook = XLSX.read(data, { type: 'string' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          // Normalize Keys (Spec 3.4 & robustness)
          const normalizedData = jsonData.map((row) => {
            const newRow = {};
            Object.keys(row).forEach((key) => {
              const lowKey = key.toLowerCase().trim();
              if (
                lowKey.includes('word') ||
                lowKey === 'en' ||
                lowKey === 'english' ||
                lowKey === 'sv' ||
                lowKey === 'swedish' ||
                lowKey === 'svenska' ||
                lowKey === '單字' ||
                lowKey === '英文' ||
                lowKey === '瑞典文'
              ) {
                newRow.word_en = row[key];
              } else if (
                lowKey === 'category' ||
                lowKey === 'categories' ||
                lowKey === 'type' ||
                lowKey === '類別' ||
                lowKey === '分類'
              ) {
                newRow.category = row[key];
              } else if (
                lowKey.includes('mean') ||
                lowKey === 'zh' ||
                lowKey === 'chinese' ||
                lowKey === '意思' ||
                lowKey === '中文'
              ) {
                newRow.meaning_zh = row[key];
              } else if (
                lowKey === 'note' ||
                lowKey === 'notes' ||
                lowKey.includes('note') ||
                lowKey === '備註' ||
                lowKey === '筆記'
              ) {
                newRow.note = row[key];
              } else if (
                lowKey.includes('example') ||
                lowKey.includes('sentence') ||
                lowKey.includes('例句')
              ) {
                // Aggregate examples
                if (!newRow.example_en) newRow.example_en = [];
                const val = row[key].toString().trim();
                if (val) newRow.example_en.push(val);
              } else {
                newRow[key] = row[key]; // Keep original for preview
              }
            });

            // Ensure example_en is an array even if empty found
            if (!newRow.example_en) newRow.example_en = [];

            return newRow;
          });

          pendingImportData = normalizedData;
          App.renderImportPreview(normalizedData);

          // Enable Confirm Button
          if (confirmBtn && pendingImportData.length > 0) {
            confirmBtn.disabled = false;
          }
        } catch (err) {
          console.error('Parse Error', err);
          if (confirmBtn) confirmBtn.disabled = true;
          showPopup(
            'Notification',
            `<p>Failed to parse file. Please ensure it is a valid CSV.</p>`,
          );
        }
      };
      reader.readAsText(file);
    });

    on($('#confirm-import-btn'), 'click', async () => {
      if (pendingImportData.length === 0) return;
      const btn = $('#confirm-import-btn');
      btn.disabled = true;
      btn.textContent = 'Importing...';

      try {
        // Duplicate Check for Import
        const existingWords = new Set(
          App.allCards.map((c) => c.word_en.toLowerCase()),
        );
        const uniqueToImport = [];
        let duplicateCount = 0;

        pendingImportData.forEach((card) => {
          if (!card.word_en) return;
          if (existingWords.has(card.word_en.toLowerCase())) {
            duplicateCount++;
          } else {
            uniqueToImport.push(card);
            // Treat within-batch duplicates? Let's just be simple and add to existingWords to prevent batch duplicates too
            existingWords.add(card.word_en.toLowerCase());
          }
        });

        if (uniqueToImport.length === 0) {
          showPopup(
            'Import result',
            `<p>No new cards were added. All <b>${duplicateCount}</b> items in the file are already in your list.</p>`,
          );
          return;
        }

        const count = await DataService.batchAddCards(
          uniqueToImport,
          App.currentLanguageMode,
        );
        await App.refreshData();

        let message = `<p>Successfully processed <b>${count}</b> new cards!</p>`;
        if (duplicateCount > 0) {
          message += `<p class="modal-note-primary">Note: <b>${duplicateCount}</b> duplicate words were skipped.</p>`;
        }

        showPopup('Import complete', message);
      } catch (error) {
        console.error('Import process failed:', error);
        showPopup(
          'Import failed',
          '<p>The import might have failed due to network issues.</p>',
        );
      } finally {
        btn.disabled = false;
        btn.textContent = 'Import';
        $('#csv-file-input').value = '';
        $('#csv-file-input').value = '';
        $('#import-preview').classList.add('hidden');
        showView('dashboard');
      }
    });

    // Exit Review
    on($('#exit-review-btn'), 'click', () => {
      showPopup(
        'Exit Review',
        '<p>Are you sure you want to exit the review session? <br><small class="modal-note">Progress in this session will be discarded.</small></p>',
        {
          onConfirm: () => {
            ReviewManager.cancel();
            showView('dashboard');
            App.renderDashboard(); // Update stats (restored)
          },
          confirmText: 'Exit',
          cancelText: 'Stay',
        },
      );
    });

    on($('#reveal-btn'), 'click', () => {
      ReviewManager.reveal();
    });

    // NEW Review Controls Binding (Architecture Refactor)
    on($('#btn-assess-forgot'), 'click', () => ReviewManager.assess(false));
    on($('#btn-assess-know'), 'click', () => ReviewManager.assess(true));
    on($('#btn-next-card'), 'click', () => ReviewManager.next());

    // --- Card Preview Page Events ---
    on($('#btn-back-card-preview'), 'click', () => {
      showView('words');
    });

    on($('.preview-star-btn'), 'click', async () => {
      if (App.currentPreviewId) {
        const card = App.allCards.find((c) => c.id === App.currentPreviewId);
        if (card) {
          await App.toggleStar(card.id, card.is_starred);
          App.showCardPreview(card.id); // Refresh view state
        }
      }
    });

    on($('.preview-edit-btn'), 'click', () => {
      if (App.currentPreviewId) {
        App.handleEdit(App.currentPreviewId);
      }
    });

    on($('.preview-delete-btn'), 'click', () => {
      if (App.currentPreviewId) {
        App.handleDelete(App.currentPreviewId);
      }
    });

    const navigatePreview = (direction) => {
      if (!App.currentPreviewId) return;
      const list = App.currentList || App.allCards;
      const currentIndex = list.findIndex((c) => c.id === App.currentPreviewId);
      if (currentIndex === -1) return;

      let nextIndex;
      if (direction === 'next') {
        nextIndex = (currentIndex + 1) % list.length;
      } else {
        nextIndex = (currentIndex - 1 + list.length) % list.length;
      }
      App.showCardPreview(list[nextIndex].id);
    };

    on($('#preview-prev-btn'), 'click', () => navigatePreview('prev'));
    on($('#preview-next-btn'), 'click', () => navigatePreview('next'));
  },

  handleEdit: (id) => {
    const card = App.allCards.find((c) => c.id === id);
    if (!card) return;
    const config = App.getLanguageConfig();

    // Populate Form
    App.setControlValue('#word_en', card.word_en);
    App.setControlValue('#meaning_zh', card.meaning_zh);
    App.setControlValue('#category', card.category || '');
    App.setControlValue('#note', card.note || '');
    App.setControlChecked('#is_starred', card.is_starred);

    // Populate Examples
    $('#examples-container').innerHTML = '';
    if (card.example_en && card.example_en.length > 0) {
      card.example_en.forEach((ex) => App.addExampleInput(ex));
    } else {
      App.addExampleInput();
    }

    // Set State
    App.editingCardId = id;

    // Update View Title
    // Note: We need a better selector if there are multiple h1s, but view-header-flex h1 inside #add-card is unique enough or we use context
    document.querySelector('#add-card .view-header-flex h1').textContent =
      config.editTitle;
    App.setButtonText('#save-card-btn', config.updateActionLabel);

    showView('add-card');
  },

  renderDashboard: () => {
    const dashboardCards = App.allCards;

    // Advanced Stats Calculation
    const now = new Date();

    let dueTotal = 0,
      dueNew = 0,
      dueLrn = 0,
      dueMst = 0;
    let totalNew = 0,
      totalLrn = 0,
      totalMst = 0;

    dashboardCards.forEach((card) => {
      const stats = card.review_stats || {};

      // Use the exact same logic as card display to count states
      const level = getFamiliarityLevel(stats);
      const label = level.label.toUpperCase(); // 'NEW', 'LEARNING', 'MASTERED'

      // Total State Count
      if (label === 'NEW') totalNew++;
      else if (label === 'LEARNING') totalLrn++;
      else if (label === 'MASTERED') totalMst++;

      // Due Calculation
      let isDue = false;

      // New cards are not "Due" for review until they have been learned at least once
      if (label !== 'NEW') {
        if (!stats.next_review_date) {
          isDue = true;
        } else {
          const nextDate = stats.next_review_date.toDate
            ? stats.next_review_date.toDate()
            : new Date(stats.next_review_date);
          if (nextDate <= now) isDue = true;
        }
      }

      if (isDue) {
        dueTotal++;
        if (label === 'NEW') dueNew++;
        else if (label === 'LEARNING') dueLrn++;
        else if (label === 'MASTERED') dueMst++;

        // Separate Word vs Phrase Count
        const isPhrase = card.word_en.trim().split(/\s+/).length > 1;
        if (isPhrase) {
          // It's a phrase
        } else {
          // It's a word
        }
      }
    });

    // Re-loop for efficient breakdown or just integrate above?
    // Integrated above is cleaner but need variables.
    // Let's refactor the loop slightly to be cleaner.

    // Reset counters
    dueTotal = 0;
    dueNew = 0;
    dueLrn = 0;
    dueMst = 0;
    totalNew = 0;
    totalLrn = 0;
    totalMst = 0;
    let dueWordCount = 0;
    let duePhraseCount = 0;

    dashboardCards.forEach((card) => {
      const stats = card.review_stats || {};
      const level = getFamiliarityLevel(stats);
      const label = level.label.toUpperCase();

      if (label === 'NEW') totalNew++;
      else if (label === 'LEARNING') totalLrn++;
      else if (label === 'MASTERED') totalMst++;

      let isDue = false;
      if (label !== 'NEW') {
        if (!stats.next_review_date) {
          isDue = true;
        } else {
          const nextDate = stats.next_review_date.toDate
            ? stats.next_review_date.toDate()
            : new Date(stats.next_review_date);
          if (nextDate <= now) isDue = true;
        }
      }

      if (isDue) {
        dueTotal++;
        const isPhrase = card.word_en.trim().split(/\s+/).length > 1;
        if (isPhrase) duePhraseCount++;
        else dueWordCount++;
      }
    });

    // Update Dashboard DOM
    if ($('#dashboard-new-count'))
      App.countUp($('#dashboard-new-count'), 0, totalNew, 1000);
    if ($('#dashboard-lrn-count'))
      App.countUp($('#dashboard-lrn-count'), 0, totalLrn, 1000);
    if ($('#dashboard-mst-count'))
      App.countUp($('#dashboard-mst-count'), 0, totalMst, 1000);
    const goalReviewed = Math.min(dueTotal, 30);
    if ($('#goal-reviewed-count'))
      $('#goal-reviewed-count').textContent = goalReviewed;
    if ($('#goal-progress-value')) {
      $('#goal-progress-value').style.width =
        `${Math.min(100, (goalReviewed / 30) * 100)}%`;
    }

    const elDueCount = $('#due-count');
    const elDueCard = $('#card-due-container');
    const elActionLabel = $('#start-review-action');
    const masteryPercentEl = $('#mastery-percent');
    const masteryRingValue = $('#mastery-ring-value');
    const mockupDueCount = $('#mockup-due-count');

    // Breakdown Elements
    const elDueWord = $('#due-count-word');
    const elDuePhrase = $('#due-count-phrase');

    if (elDueCount) {
      App.countUp(elDueCount, 0, dueTotal, 1000);
    }

    if (mockupDueCount) {
      mockupDueCount.textContent = dueTotal;
    }

    if (elDueWord) elDueWord.textContent = dueWordCount;
    if (elDuePhrase) elDuePhrase.textContent = duePhraseCount;

    const totalCards = dashboardCards.length;
    const masteryPercent =
      totalCards > 0 ? Math.round((totalMst / totalCards) * 100) : 0;
    if (masteryPercentEl) masteryPercentEl.textContent = `${masteryPercent}%`;
    if (masteryRingValue) {
      const circumference = 188.5;
      masteryRingValue.style.strokeDashoffset = String(
        circumference - (circumference * masteryPercent) / 100,
      );
    }

    if (elDueCard && elActionLabel) {
      elDueCard.classList.remove('green', 'is-complete');
      elDueCard.classList.add('orange');
      elActionLabel.disabled = false;
      elActionLabel.setAttribute('aria-label', 'Start review');
      elActionLabel.setAttribute('title', 'Start review');
      elActionLabel.innerHTML =
        '<span class="material-symbols-rounded">play_arrow</span>';
    }

    // List rendering
    const container = $('#card-list-modern');
    if (!container) return; // Fallback if view not active

    // Get filter values
    const showStarredOnly = App.getControlChecked('#filter-starred-only');
    const searchQuery = App.getControlValue('#search-input')
      .toLowerCase()
      .trim();
    const statusFilter = App.getControlValue('#filter-status', 'all');
    const categoryFilter = App.getControlValue('#filter-category', 'all');

    // Apply filtering
    const filteredCards = App.allCards
      .filter((card) => {
        // Starred filter
        const isStarred =
          card.is_starred === true || String(card.is_starred) === 'true';
        if (showStarredOnly && !isStarred) return false;

        // Search filter (word or meaning)
        if (
          searchQuery &&
          !card.word_en.toLowerCase().includes(searchQuery) &&
          !card.meaning_zh.toLowerCase().includes(searchQuery) &&
          !(card.note || '').toLowerCase().includes(searchQuery)
        ) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'all') {
          const level = getFamiliarityLevel(card.review_stats);
          if (level.class.replace('level-', '') !== statusFilter) return false;
        }

        if (!categoryMatchesFilter(card, categoryFilter)) return false;

        // Type filter
        const typeFilter = $('#filter-type')
          ? App.getControlValue('#filter-type', 'word')
          : 'word';
        const isPhrase = card.word_en.trim().split(/\s+/).length > 1;
        if (typeFilter === 'word' && isPhrase) return false;
        if (typeFilter === 'phrase' && !isPhrase) return false;

        return true;
      })
      .sort((a, b) => {
        // Primary Sort: Created At (Desc) - Join Time
        const getTime = (t) => {
          if (!t) return 0;
          return t.toDate ? t.toDate().getTime() : new Date(t).getTime();
        };
        // Use ONLY created_at for stability. fallback to 0 if missing.
        const aTime = getTime(a.created_at);
        const bTime = getTime(b.created_at);

        if (bTime !== aTime) return bTime - aTime;

        // Secondary Sort: ID (Stable Tie-breaker for batch imports)
        return (a.id || '').localeCompare(b.id || '');
      });

    // Pagination Logic
    App.currentList = filteredCards; // Save for navigation
    const isMobile = window.innerWidth <= 899;
    const ITEMS_PER_PAGE = 15;
    const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE) || 1;
    App.lastFilteredCount = filteredCards.length;

    // Ensure current page is valid
    if (App.currentPage > totalPages) App.currentPage = totalPages;
    if (App.currentPage < 1) App.currentPage = 1;

    const startIdx = (App.currentPage - 1) * ITEMS_PER_PAGE;
    const pagedCards = isMobile
      ? filteredCards
      : filteredCards.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    // Update Pagination UI
    const paginationEl = $('#pagination-controls');
    if (paginationEl) {
      // Only show pagination on desktop AND if there's more than one page
      if (!isMobile && filteredCards.length > ITEMS_PER_PAGE) {
        paginationEl.classList.remove('hidden');
        $('#page-indicator').textContent =
          `Page ${App.currentPage} of ${totalPages}`;

        const prevBtn = $('#prev-page-btn');
        prevBtn.disabled = App.currentPage === 1;
        prevBtn.style.opacity = App.currentPage === 1 ? '0.5' : '1';
        prevBtn.style.cursor =
          App.currentPage === 1 ? 'not-allowed' : 'pointer';

        const nextBtn = $('#next-page-btn');
        nextBtn.disabled = App.currentPage === totalPages;
        nextBtn.style.opacity = App.currentPage === totalPages ? '0.5' : '1';
        nextBtn.style.cursor =
          App.currentPage === totalPages ? 'not-allowed' : 'pointer';
      } else {
        paginationEl.classList.add('hidden');
      }
    }

    container.innerHTML = renderVocabularyTableShell();

    const tbody = container.querySelector('#vocab-table-body');
    const listEl = container.querySelector('.vocab-list-modern');

    if (filteredCards.length === 0) {
      const emptyMsg = renderEmptyState('No vocabulary found.');
      tbody.innerHTML = `<tr><td colspan="4">${emptyMsg}</td></tr>`;
      listEl.innerHTML = emptyMsg;
      return;
    }

    pagedCards.forEach((card) => {
      const level = getFamiliarityLevel(card.review_stats);
      const row = createVocabularyTableRow(card, level);
      tbody.appendChild(row);

      const cardEl = createVocabularyCard(card, level);
      listEl.appendChild(cardEl);
    });
  },

  setupPreviewAudio: (word, languageCode) => {
    const audioBtn = $('#preview-audio-btn');
    if (!audioBtn) return;

    const cleanWord = String(word || '').trim();
    const icon = audioBtn.querySelector('md-icon, .material-symbols-rounded');

    if (!cleanWord || !languageCode) {
      audioBtn.disabled = true;
      audioBtn.style.opacity = '0.3';
      audioBtn.style.cursor = 'default';
      if (icon) icon.textContent = 'volume_off';
      audioBtn.onclick = null;
      return;
    }

    audioBtn.disabled = false;
    audioBtn.style.opacity = '1';
    audioBtn.style.cursor = 'pointer';
    if (icon) icon.textContent = 'volume_up';
    audioBtn.onclick = async () => {
      const played = await playPronunciation(cleanWord, languageCode);
      if (!played) {
        showPopup(
          'Audio Unavailable',
          '<p>Your browser could not play audio for this word.</p>',
        );
      }
    };
  },

  showCardPreview: (id) => {
    const card = App.allCards.find((c) => c.id === id);
    if (!card) return;

    App.currentPreviewId = id;
    const level = getFamiliarityLevel(card.review_stats);
    const config = App.getLanguageConfig();
    const dictionaryEnabled = config.dictionaryEnabled;
    const note = String(card.note || '').trim();
    const noteSection = renderPreviewSection('筆記', note);
    const examples = Array.isArray(card.example_en)
      ? card.example_en.filter((ex) => String(ex).trim().length > 0)
      : [];
    const exampleSection = renderPreviewSection(config.exampleLabel, examples);
    const dictionaryMetrics = dictionaryEnabled
      ? `
                <div id="preview-phonetic-container" class="preview-metric-card hidden">
                    <div class="preview-section-label">Phonetic</div>
                    <div id="preview-phonetic-badge" class="preview-metric-value"></div>
                </div>
      `
      : '';
    const dictionarySections = dictionaryEnabled
      ? `
            <div id="preview-synonyms-container" class="preview-section hidden">
                <div class="preview-section-label">Synonyms</div>
                <div id="preview-synonyms-value" class="preview-section-content"></div>
            </div>

            <div id="preview-definitions-container" class="preview-section hidden">
                <!-- Injected via JS -->
            </div>
      `
      : '';

    // 1. Render Content into the new view container
    const container = $('#card-preview-container');
    container.innerHTML = renderPreviewPage({
      card,
      level,
      noteSection,
      exampleSection,
      dictionaryMetrics,
      dictionarySections,
    });

    // 2. Update Footer States (Star Icon)
    const starBtn = document.querySelector('.preview-star-btn');
    if (starBtn) {
      const isStarred =
        card.is_starred === true || String(card.is_starred) === 'true';
      const img = starBtn.querySelector('img');
      if (isStarred) {
        img.src = 'assets/star-filled.svg';
        // img.style.filter = 'none';
      } else {
        img.src = 'assets/star.svg';
        // img.style.filter = 'grayscale(100%) opacity(0.5)';
      }
    }

    // 3. Switch View
    showView('card-preview');

    // 4. Configure Audio Button & Fetch Data
    App.setupPreviewAudio(card.word_en, config.ttsLanguage);

    if (dictionaryEnabled) {
      App.fetchDictionaryData(card.word_en, config.dictionaryLanguage);
    } else {
      hideLoading('#card-preview');
    }
  },

  fetchDictionaryData: async (word, language = 'en') => {
    // const phoneticContainer = $('#preview-phonetic-container'); // Removed
    const phoneticBadge = $('#preview-phonetic-badge');
    const phoneticContainer = $('#preview-phonetic-container');
    // const posValue = $('#preview-pos-value'); // Removed
    const synonymsValue = $('#preview-synonyms-value');
    const synonymsContainer = $('#preview-synonyms-container');
    const definitionsContainer = $('#preview-definitions-container');

    // Show full page loading with delay
    showLoading('#card-preview', { delay: 300 });

    try {
      if (definitionsContainer) {
        definitionsContainer.innerHTML = '';
        definitionsContainer.classList.add('hidden');
        definitionsContainer.style.minHeight = '140px';
      }
      if (phoneticContainer) phoneticContainer.classList.add('hidden');
      if (synonymsContainer) synonymsContainer.classList.add('hidden');

      const cleanWord = word.trim().toLowerCase();
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/${language}/${cleanWord}`,
      );
      if (!response.ok) throw new Error('Not found');

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) return;

      const entry = data[0];

      // 1. Phonetics
      let phoneticText = entry.phonetic || '';

      if (entry.phonetics) {
        const textEntry = entry.phonetics.find(
          (p) => p.text && p.text.length > 0,
        );

        if (!phoneticText && textEntry) phoneticText = textEntry.text;
      }

      // if (phoneticContainer && phoneticText) ... Removed subtitle logic

      // 2. Populate Phonetic Badge
      if (phoneticBadge && phoneticContainer && phoneticText) {
        phoneticBadge.textContent = phoneticText;
        phoneticContainer.classList.remove('hidden');
      }

      // 3. Definitions (Grouped by POS)
      const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
      const posMap = {
        noun: 'n.',
        verb: 'v.',
        adjective: 'adj.',
        adverb: 'adv.',
        pronoun: 'pron.',
        preposition: 'prep.',
        conjunction: 'conj.',
        interjection: 'interj.',
        determiner: 'det.',
        article: 'art.',
      };
      const definitionItems = meanings.flatMap((m) => {
        const partOfSpeech = String(m.partOfSpeech || '');
        const posAbbr = posMap[partOfSpeech.toLowerCase()] || partOfSpeech;

        const definitions = Array.isArray(m.definitions) ? m.definitions : [];
        return definitions
          .filter((d) => d.definition)
          .slice(0, 2)
          .map((d) => ({ posAbbr, definition: d.definition }));
      });

      if (definitionsContainer && definitionItems.length > 0) {
        let defsHtml = `
            <div class="definition-toggle" onclick="const content = this.nextElementSibling; const icon = this.querySelector('md-icon, .material-symbols-rounded'); content.style.display = content.style.display === 'none' ? 'flex' : 'none'; icon.style.transform = content.style.display === 'none' ? 'rotate(0deg)' : 'rotate(90deg)';">
                <span>OTHER DEFINITIONS</span>
                <md-icon>chevron_right</md-icon>
            </div>
        `;
        defsHtml += `<div class="definition-list">`;

        definitionItems.forEach((item) => {
          defsHtml += `
                <div>
                   <span class="definition-pos">${escapeHtml(item.posAbbr)}</span>
                   <span>${escapeHtml(item.definition)}</span>
                </div>
             `;
        });

        defsHtml += `</div>`;
        definitionsContainer.innerHTML = defsHtml;
        definitionsContainer.classList.remove('hidden');
      }

      // 3. Synonyms
      const synonyms = meanings.flatMap((m) => m.synonyms || []).slice(0, 5);
      if (synonymsValue && synonymsContainer && synonyms.length > 0) {
        synonymsValue.textContent = synonyms.join(', ');
        synonymsContainer.classList.remove('hidden');
      }
    } catch (err) {
      console.log('Dictionary data not found:', err);
      // Optional: show a "Not found" message in definitions container?
      if (definitionsContainer) {
        // If we want to hide it completely when not found:
        definitionsContainer.classList.add('hidden');
      }
    } finally {
      hideLoading('#card-preview');
      if (definitionsContainer) {
        definitionsContainer.style.minHeight = '';
        // If innerHTML is empty (no defs found or error), hide it
        if (!definitionsContainer.innerHTML) {
          definitionsContainer.classList.add('hidden');
        }
      }
    }
  },

  // Exposed for onclick handlers
  toggleStar: async (id, status) => {
    // Optimistic update
    const card = App.allCards.find((c) => c.id === id);
    if (card) {
      const currentlyStarred =
        card.is_starred === true || String(card.is_starred) === 'true';
      card.is_starred = !currentlyStarred;
      App.renderDashboard();
    }
    await DataService.toggleStar(id, status, App.currentLanguageMode);
    // No need to full refresh for star, optimistic is fine.
  },

  handleDelete: async (id) => {
    showPopup(
      'Delete Card',
      '<p>Are you sure you want to delete this card? This action cannot be undone.</p>',
      {
        confirmText: 'Delete',
        onConfirm: async () => {
          try {
            await DataService.deleteCard(id, App.currentLanguageMode);
            await App.refreshData();
            showPopup('Deleted', '<p>Card has been removed.</p>');
            if ($('#card-preview').classList.contains('active')) {
              showView('words');
            }
          } catch (err) {
            showPopup('Error', 'Failed to delete card.');
            console.error(err);
          }
        },
      },
    );
  },

  renderImportPreview: (data) => {
    const previewData = data.slice(0, 5);
    const importPreviewContainer = $('#import-preview');
    const previewList = $('#preview-list');

    // Update Header with Count
    const sectionLabel = importPreviewContainer.querySelector('.section-label');
    if (sectionLabel) {
      sectionLabel.innerHTML = `Data Preview <span class="import-count">(${escapeHtml(data.length)} vocabularies)</span>`;
    }

    if (importPreviewContainer) {
      importPreviewContainer.classList.remove('hidden');
      $('#import-file-section').classList.add('hidden');
    }

    if (previewData.length > 0) {
      let listHTML = '';
      previewData.forEach((row) => {
        const word = row.word_en || '';
        const meaning = row.meaning_zh || '';
        const category = normalizeCategory(row.category);
        const note = row.note || '';
        const examples = row.example_en || [];

        listHTML += renderImportPreviewItem({
          word,
          meaning,
          category,
          note,
          examples,
        });
      });
      previewList.innerHTML = listHTML;
    }
  },
};

// Start App
App.init();

// Expose App for global handlers
window.App = App;
