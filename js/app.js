// Main App Logic (ES Module)
import DataService from './data.js';
import ReviewManager, {
  calculateFamiliarity,
  getFamiliarityLevel,
} from './review.js';
import {
  $,
  $$,
  on,
  showView,
  showPopup,
  closeModal,
  showLoading,
  hideLoading,
} from './utils.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

const App = {
  allCards: [],
  currentPage: 1, // Pagination State
  userInfo: null,
  editingCardId: null, // Track editing state
  currentPreviewId: null, // Track current preview card

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
    const inputs = container.querySelectorAll('.example-row');
    if (inputs.length >= 5) {
      showPopup(
        'Limit Reached',
        'You can include at most 5 example sentences.'
      );
      return;
    }

    const div = document.createElement('div');
    div.className = 'example-row';
    div.innerHTML = `
      <textarea
        rows="2"
        placeholder="e.g., She is a resilient person."
        class="input-pill example-input"
        style="min-height: 80px; padding-right: 3rem;"
      >${value}</textarea>
      ${`<button type="button" class="btn-remove-example">
           <span class="material-icons icon-sm">close</span>
         </button>`}
    `;

    container.appendChild(div);
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

  init: async () => {
    App.bindEvents();

    const auth = getAuth();

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        App.userInfo = user;
        showView('dashboard');
        await App.refreshData();
      } else {
        showView('login');
      }
    });

    // Handle Login Button
    const loginBtn = $('#google-login-btn');
    if (loginBtn) {
      on(loginBtn, 'click', async () => {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
        } catch (error) {
          console.error('Login failed', error);
          showPopup('Login Error', `<p>${error.message}</p>`);
        }
      });
    }
  },

  refreshData: async () => {
    // Show loading covering the entire workspace (including navbar)
    const workspace = document.querySelector('.main-workspace');
    if (workspace) {
      showLoading('.main-workspace');
    }

    // Hide Navigation & FABs during load (User Request)
    const bottomNav = $('#bottom-nav-container');
    if (bottomNav) bottomNav.classList.add('hidden');

    try {
      const cards = await DataService.fetchCards();
      App.allCards = cards;
      App.currentPage = 1; // Reset to page 1 on full refresh
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
          `<p>The account <b>${email}</b> is not authorized to access this database.</p><p style="font-size:0.85em; color:#666">Server Rejected Request.</p>`
        );
        showView('login');
        return;
      }

      showPopup(
        'Network Error',
        `<p>Could not load cards. Details: <br><b>${e.message}</b></p>`
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
    const scope = $('select[name="scope"]').value; // 'all' or 'starred'
    const statusFilter = $('select[name="status"]').value; // 'all', 'new', 'learning', 'mastered'
    const typeFilter = $('select[name="type"]').value; // 'word' or 'phrase'
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
    // Global Keydown Listener for Review Navigation
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;

      // Ensure Review Session is Active
      const reviewView = $('#review-session');
      if (!reviewView || !reviewView.classList.contains('active')) return;

      // Ensure NO Modal is Open (prevent accidental skips when confirming exit)
      const overlay = $('#modal-overlay');
      if (
        overlay &&
        overlay.style.display &&
        overlay.style.display !== 'none'
      ) {
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

    // Navigation Interception
    // Navigation Interception
    $$('.nav-btn, .nav-item, .fab-action-btn').forEach((btn) => {
      on(btn, 'click', () => {
        const target = btn.getAttribute('data-target');

        // Reset Import View State
        if (target === 'import') {
          $('#import-preview').classList.add('hidden');
          $('#import-file-section').classList.remove('hidden');
          $('#csv-file-input').value = '';
        }

        if (target === 'add-card') {
          // Reset and init form with one empty input
          $('#add-card-form').reset();
          $('#examples-container').innerHTML = '';
          App.addExampleInput();

          // Reset Edit State
          App.editingCardId = null;
          $('#add-card .view-header-flex h1').textContent = 'Add New Card';
          $('button[form="add-card-form"]').textContent = 'Save Card';

          // Show Import Button
          const importBtn = $('#btn-goto-import');
          if (importBtn) importBtn.style.display = 'flex';
        }

        if (target === 'dashboard' || target === 'words') {
          App.renderDashboard();
        }

        if (target === 'review-setup') {
          // Reset scope to 'all' on enter or handle based on current selection
          App.updateDueCount();
        }

        showView(target);
      });
    });

    // Context FAB Bindings
    const fabReview = $('#fab-review');
    const fabAdd = $('#fab-add-card');
    const btnGotoImport = $('#btn-goto-import');

    if (fabReview) {
      on(fabReview, 'click', () => {
        showView('review-setup');
        App.updateDueCount();
      });
    }

    if (fabAdd) {
      on(fabAdd, 'click', () => {
        // Reset and init form
        $('#add-card-form').reset();
        $('#examples-container').innerHTML = '';
        App.addExampleInput();

        App.editingCardId = null;
        $('#add-card .view-header-flex h1').textContent = 'Add New Card';
        $('button[form="add-card-form"]').textContent = 'Save Card';

        // Show Import Button
        const importBtn = $('#btn-goto-import');
        if (importBtn) importBtn.style.display = 'flex';

        showView('add-card');
      });
    }

    if (btnGotoImport) {
      on(btnGotoImport, 'click', () => {
        $('#import-preview').classList.add('hidden');
        $('#import-file-section').classList.remove('hidden');
        $('#csv-file-input').value = '';
        showView('import');
      });
    }

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
        // Return to Add Card view
        showView('add-card');
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
    on($('select[name="scope"]'), 'change', () => {
      App.updateDueCount();
    });

    // Handle Review Status Filter Change (For Due Count Update)
    on($('select[name="status"]'), 'change', () => {
      App.updateDueCount();
    });

    // Handle Review Type Change (Disable Cloze for Phrases + Update Due Count)
    const reviewTypeSelect = $('#review-setup-type');
    if (reviewTypeSelect) {
      on(reviewTypeSelect, 'change', () => {
        // 1. Update Due Count
        App.updateDueCount();

        // 2. Cloze Logic
        const isPhrase = reviewTypeSelect.value === 'phrase';
        const clozeLabel = $('#grade-mode-cloze');
        const clozeInput = clozeLabel.querySelector('input');

        if (isPhrase) {
          clozeLabel.style.opacity = '0.5';
          clozeLabel.style.pointerEvents = 'none';
          if (clozeInput.checked) {
            // Switch to Flip EN if Cloze was selected
            document.querySelector(
              'input[name="mode"][value="1"]'
            ).checked = true;
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

    // Cancel buttons
    $$('.cancel-nav').forEach((btn) => {
      on(btn, 'click', () => showView('dashboard'));
    });

    // Add Card Form
    on($('#add-card-form'), 'submit', async (e) => {
      e.preventDefault();
      const btn = document.querySelector('button[form="add-card-form"]');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      // Collect Examples
      const exampleInputs = $$('.example-input');
      const examples = Array.from(exampleInputs)
        .map((input) => input.value.trim())
        .filter((text) => text.length > 0);

      const card = {
        word_en: $('#word_en').value.trim(),
        meaning_zh: $('#meaning_zh').value.trim(),
        example_en: examples.length > 0 ? examples : [], // Data service will validate or we rely on required input
        is_starred: $('#is_starred').checked,
      };

      if (card.example_en.length === 0) {
        showPopup(
          'Missing Info',
          '<p>Please add at least one example sentence.</p>'
        );
        btn.disabled = false;
        btn.textContent = 'Save Card';
        return;
      }

      // Duplicate Check (Case-insensitive)
      const isDuplicate = App.allCards.some((c) => {
        if (App.editingCardId && c.id === App.editingCardId) return false;
        return c.word_en.toLowerCase() === card.word_en.toLowerCase();
      });

      if (isDuplicate) {
        showPopup(
          'Duplicate Word',
          `<p>The word "<b>${card.word_en}</b>" is already in your vocabulary list.</p>`,
          true
        );
        btn.disabled = false;
        btn.textContent = 'Save Card';
        return;
      }

      try {
        if (App.editingCardId) {
          // Update Existing Card
          await DataService.updateCard(App.editingCardId, card);
          showPopup('Updated!', '<p>Card updated successfully.</p>', true);
        } else {
          // Add New Card
          await DataService.addCard(card);
          showPopup(
            'Saved!',
            '<p>New vocabulary card added successfully.</p>',
            true
          );
        }

        e.target.reset();
        $('#examples-container').innerHTML = ''; // Clear inputs
        App.addExampleInput(); // Add one fresh input
        App.editingCardId = null; // Reset state
        $('#add-card .view-header-flex h1').textContent = 'Add New Card'; // Reset Title

        await App.refreshData(); // Refresh list
        showView('dashboard');
      } catch (err) {
        showPopup('Error', `<p>${err.message}</p>`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Card';
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
        const btn = e.target.closest('button');
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
    on($('#start-review-btn'), 'click', () => {
      showView('review-setup');
    });

    // Review Setup Start
    on($('#review-setup-form'), 'submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const scope = formData.get('scope'); // 'all' or 'starred'
      const mode = formData.get('mode');
      const limit = parseInt(formData.get('limit') || '10', 10);

      const dueOnly = formData.get('dueOnly') === 'on';
      const type = formData.get('type') || 'word';
      const status = formData.get('status') || 'all';

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

      ReviewManager.start(cardsToReview, mode);
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
                lowKey === '單字' ||
                lowKey === '英文'
              ) {
                newRow.word_en = row[key];
              } else if (
                lowKey.includes('mean') ||
                lowKey === 'zh' ||
                lowKey === 'chinese' ||
                lowKey === '意思' ||
                lowKey === '中文'
              ) {
                newRow.meaning_zh = row[key];
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
            `<p>Failed to parse file. Please ensure it is a valid CSV.</p>`
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
          App.allCards.map((c) => c.word_en.toLowerCase())
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
            'Import Result',
            `<p>No new cards were added. All <b>${duplicateCount}</b> items in the file are already in your list.</p>`
          );
          return;
        }

        const count = await DataService.batchAddCards(uniqueToImport);
        await App.refreshData();

        let message = `<p>Successfully processed <b>${count}</b> new cards!</p>`;
        if (duplicateCount > 0) {
          message += `<p style="font-size:0.85rem; color:var(--accent-orange); margin-top:0.5rem;">Note: <b>${duplicateCount}</b> duplicate words were skipped.</p>`;
        }
        // message += `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:1rem;">Offline changes sync automatically when connection is stable.</p>`;

        showPopup('Import Success', message);
      } catch (error) {
        console.error('Import process failed:', error);
        showPopup(
          'Import Error',
          '<p>The import might have failed due to network issues.</p>'
        );
      } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm Import';
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
        '<p>Are you sure you want to exit the review session?</p>',
        {
          onConfirm: () => showView('dashboard'),
          confirmText: 'Exit',
          cancelText: 'Stay',
        }
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

    // Populate Form
    $('#word_en').value = card.word_en;
    $('#meaning_zh').value = card.meaning_zh;
    $('#is_starred').checked = card.is_starred;

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
      'Edit Word';
    document.querySelector('button[form="add-card-form"]').textContent =
      'Update Word';

    // Hide Import Button
    const importBtn = $('#btn-goto-import');
    if (importBtn) importBtn.style.display = 'none';

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
      // Actually, if we use the label 'NEW', it maps to state NEW.
      // Logic: If label matches, we increment.
      // For Due: We check the date.

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
      }
    });

    // Update Dashboard DOM
    if ($('#dashboard-new-count'))
      App.countUp($('#dashboard-new-count'), 0, totalNew, 1000);
    if ($('#dashboard-lrn-count'))
      App.countUp($('#dashboard-lrn-count'), 0, totalLrn, 1000);
    if ($('#dashboard-mst-count'))
      App.countUp($('#dashboard-mst-count'), 0, totalMst, 1000);

    const elDueCount = $('#due-count');
    const elDueCard = $('#card-due-container');
    const elActionLabel = $('#start-review-action');

    if (elDueCount) {
      App.countUp(elDueCount, 0, dueTotal, 1000);
    }

    if (elDueCard && elActionLabel) {
      if (dueTotal === 0) {
        elDueCard.classList.remove('orange');
        elDueCard.classList.add('green');
        elActionLabel.textContent = 'Well Done!';
      } else {
        elDueCard.classList.remove('green');
        elDueCard.classList.add('orange');
        elActionLabel.textContent = "Let's start!";
      }
    }

    // List rendering
    const container = $('#card-list-modern');
    if (!container) return; // Fallback if view not active

    // Get filter values
    const showStarredOnly = $('#filter-starred-only').checked;
    const searchQuery = $('#search-input').value.toLowerCase().trim();
    const statusFilter = $('#filter-status').value;

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
          !card.meaning_zh.toLowerCase().includes(searchQuery)
        ) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'all') {
          const level = getFamiliarityLevel(card.review_stats);
          if (level.class.replace('level-', '') !== statusFilter) return false;
        }

        // Type filter
        const typeFilter = $('#filter-type') ? $('#filter-type').value : 'word';
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
        $(
          '#page-indicator'
        ).textContent = `Page ${App.currentPage} of ${totalPages}`;

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

    container.innerHTML = `
      <!-- Desktop Table View -->
      <div class="table-responsive">
        <table class="vocab-table">
          <thead>
            <tr>
              <th>Word</th>
              <th class="desktop-only">Meaning</th>
              <th>Status</th>
              <th style="width: 100px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="vocab-table-body"></tbody>
        </table>
      </div>

      <!-- Mobile Card View -->
      <div class="vocab-list-modern">
      </div>
    `;

    const tbody = container.querySelector('#vocab-table-body');
    const listEl = container.querySelector('.vocab-list-modern');

    if (filteredCards.length === 0) {
      const emptyMsg =
        '<div style="text-align:center; padding: 3rem; color: var(--text-muted); width: 100%;">No vocabulary found.</div>';
      tbody.innerHTML = `<tr><td colspan="4">${emptyMsg}</td></tr>`;
      listEl.innerHTML = emptyMsg;
      return;
    }

    pagedCards.forEach((card) => {
      const level = getFamiliarityLevel(card.review_stats);

      // 1. Table Row (Desktop)
      const row = document.createElement('tr');
      row.className = 'vocab-row';
      row.dataset.id = card.id;
      row.innerHTML = `
        <td>
          <div class="vocab-table-word">${card.word_en}</div>
          <div class="mobile-meaning">${card.meaning_zh}</div>
        </td>
        <td class="desktop-only">
          <div class="vocab-table-meaning">${card.meaning_zh}</div>
        </td>
        <td>
          <span class="level-indicator ${level.class}">${level.label}</span>
        </td>
        <td class="vocab-table-actions">
          <button class="icon-btn btn-star ${
            card.is_starred === true || String(card.is_starred) === 'true'
              ? 'starred'
              : ''
          }" data-starred="${
        card.is_starred === true || String(card.is_starred) === 'true'
      }">
          <button class="icon-btn btn-star ${
            card.is_starred === true || String(card.is_starred) === 'true'
              ? 'starred'
              : ''
          }" data-starred="${
        card.is_starred === true || String(card.is_starred) === 'true'
      }">
            <img src="${
              card.is_starred === true || String(card.is_starred) === 'true'
                ? 'assets/star-filled.svg'
                : 'assets/star.svg'
            }" class="action-icon" alt="star" />
          </button>
           <button class="icon-btn btn-edit">
            <img src="assets/edit.svg" class="action-icon" alt="edit" />
          </button>
          <button class="icon-btn btn-delete">
            <img src="assets/trash.svg" class="action-icon" alt="delete" />
          </button>
        </td>
      `;
      tbody.appendChild(row);

      // 2. Card (Mobile)
      const cardEl = document.createElement('div');
      cardEl.className = 'vocab-card-modern';
      cardEl.dataset.id = card.id;
      cardEl.innerHTML = `
        <div class="vocab-card-main">
          <div class="vocab-card-word">${card.word_en}</div>
          <div class="vocab-card-meaning">${card.meaning_zh}</div>
        </div>
        <div class="vocab-card-side">
          <span class="level-indicator ${level.class}">${level.label}</span>
          <div class="vocab-card-actions">
           <button class="icon-btn btn-star ${
             card.is_starred === true || String(card.is_starred) === 'true'
               ? 'starred'
               : ''
           }" data-starred="${
        card.is_starred === true || String(card.is_starred) === 'true'
      }">
           <button class="icon-btn btn-star ${
             card.is_starred === true || String(card.is_starred) === 'true'
               ? 'starred'
               : ''
           }" data-starred="${
        card.is_starred === true || String(card.is_starred) === 'true'
      }">
             <img src="${
               card.is_starred === true || String(card.is_starred) === 'true'
                 ? 'assets/star-filled.svg'
                 : 'assets/star.svg'
             }" class="action-icon" alt="star" />
           </button>
            <button class="icon-btn btn-edit">
             <img src="assets/edit.svg" class="action-icon" alt="edit" />
           </button>
           <button class="icon-btn btn-delete">
             <img src="assets/trash.svg" class="action-icon" alt="delete" />
           </button>
         </div>
        </div>
      `;
      listEl.appendChild(cardEl);
    });
  },

  showCardPreview: (id) => {
    const card = App.allCards.find((c) => c.id === id);
    if (!card) return;

    App.currentPreviewId = id;
    const level = getFamiliarityLevel(card.review_stats);

    // 1. Render Content into the new view container
    const container = $('#card-preview-container');
    container.innerHTML = `
        <div style="text-align:center; padding-top:2rem; width: 100%;">
            <div style="font-size:2.5rem; font-weight:800; letter-spacing:-0.03em; margin-bottom: 0.5rem; color: var(--text-main);">${
              card.word_en
            }</div>

            <div style="font-size:1.25rem; color:var(--text-muted); margin-bottom:3.5rem; font-weight: 500;">${
              card.meaning_zh
            }</div>

            <div style="display:flex; gap:1rem; margin-bottom: 2rem; justify-content: center; width: 100%;">
                <div class="status-badge-container status-${level.label.toLowerCase()}" style="flex: 1; padding: 1rem 1.5rem; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div class="status-label" style="font-size: 0.75rem; font-weight: 700; margin-bottom: 4px;">STATUS</div>
                    <div class="status-value" style="font-size: 1.25rem; font-weight: 800;">${level.label.toUpperCase()}</div>
                </div>
                <div style="flex: 1; background:var(--bg-workspace); padding:1rem 1.5rem; border-radius:16px; min-width: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-bottom:4px; text-transform: uppercase;">PHONETIC</div>
                    <div id="preview-phonetic-badge" style="font-weight:800; color:var(--text-main); font-size: 1.25rem; font-family:'Lucida Sans Unicode', 'Arial Unicode MS', sans-serif;">-</div>
                </div>
            </div>





            <div style="border-radius:20px; text-align:left; margin-bottom: 2rem;">
                <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:0.75rem;">Example Sentences</div>
                <div style="font-size:1.1rem; line-height:1.6; display: flex; flex-direction: column; gap: 12px; color: var(--text-main);">
                    ${
                      Array.isArray(card.example_en) &&
                      card.example_en.length > 0
                        ? card.example_en
                            .map((ex) => `<div>${ex}</div>`)
                            .join('')
                        : '<i style="color: var(--text-muted);">No example provided.</i>'
                    }
                </div>
            </div>
            <div style="border-radius:20px; text-align:left">
                <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:0.75rem;">SYNONYMS</div>
                <div id="preview-synonyms-value" style="font-size:1.1rem; line-height:1.6; color: var(--text-main);">-</div>
            </div>

            <div id="preview-definitions-container" style="border-radius:20px; text-align:left; margin-top: 2rem; margin-bottom: 2rem; display: none;">
                <!-- Injected via JS -->
            </div>
        </div>
    `;

    // 2. Update Footer States (Star Icon)
    const starBtn = document.querySelector(
      '#card-preview-footer .preview-star-btn'
    );
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

    // 4. Reset Audio Button & Fetch Data
    const audioBtn = $('#preview-audio-btn');
    if (audioBtn) {
      audioBtn.disabled = true;
      audioBtn.style.opacity = '0.3';
      audioBtn.style.cursor = 'default';
      const img = audioBtn.querySelector('img');
      if (img) img.src = 'assets/audio-off.svg';
      audioBtn.onclick = null;
    }

    App.fetchDictionaryData(card.word_en);
  },

  fetchDictionaryData: async (word) => {
    // const phoneticContainer = $('#preview-phonetic-container'); // Removed
    const phoneticBadge = $('#preview-phonetic-badge');
    // const posValue = $('#preview-pos-value'); // Removed
    const synonymsValue = $('#preview-synonyms-value');
    const definitionsContainer = $('#preview-definitions-container');
    const audioBtn = $('#preview-audio-btn');

    // Show full page loading with delay
    showLoading('#card-preview', { delay: 300 });

    try {
      if (definitionsContainer) {
        definitionsContainer.innerHTML = '';
        definitionsContainer.style.display = 'block';
        definitionsContainer.style.minHeight = '140px';
      }

      const cleanWord = word.trim().toLowerCase();
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`
      );
      if (!response.ok) throw new Error('Not found');

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) return;

      const entry = data[0];

      // 1. Phonetics & Audio
      let phoneticText = entry.phonetic || '';
      let audioUrl = '';

      if (entry.phonetics) {
        const audioEntry = entry.phonetics.find(
          (p) => p.audio && p.audio.length > 0
        );
        const textEntry = entry.phonetics.find(
          (p) => p.text && p.text.length > 0
        );

        if (audioEntry) audioUrl = audioEntry.audio;
        if (!phoneticText && textEntry) phoneticText = textEntry.text;
      }

      // if (phoneticContainer && phoneticText) ... Removed subtitle logic

      if (audioBtn) {
        const img = audioBtn.querySelector('img');
        if (audioUrl) {
          audioBtn.disabled = false;
          audioBtn.style.opacity = '1';
          audioBtn.style.cursor = 'pointer';
          if (img) img.src = 'assets/audio.svg';
          audioBtn.onclick = () => {
            new Audio(audioUrl).play();
          };
        } else {
          audioBtn.disabled = true;
          audioBtn.style.opacity = '0.3';
          audioBtn.style.cursor = 'default';
          if (img) img.src = 'assets/audio-off.svg';
        }
      }

      // 2. Populate Phonetic Badge
      if (phoneticBadge) {
        phoneticBadge.textContent = phoneticText || '-';
      }

      // 3. Definitions (Grouped by POS)
      if (definitionsContainer && entry.meanings.length > 0) {
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

        let defsHtml = `
            <div onclick="const content = this.nextElementSibling; const icon = this.querySelector('.material-icons'); content.style.display = content.style.display === 'none' ? 'flex' : 'none'; icon.style.transform = content.style.display === 'none' ? 'rotate(0deg)' : 'rotate(90deg)';"
                 style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:0.75rem;">
                <span>OTHER DEFINITIONS</span>
                <span class="material-icons" style="font-size:16px; transition: transform 0.2s;">chevron_right</span>
            </div>
        `;
        defsHtml += `<div style="font-size:1.1rem; line-height:1.6; color: var(--text-main); display: none; flex-direction: column; gap: 0.75rem;">`;

        entry.meanings.forEach((m) => {
          // Limit definitions to top 2 per POS to avoid clutter
          const topDefs = m.definitions.slice(0, 2);
          const posAbbr =
            posMap[m.partOfSpeech.toLowerCase()] || m.partOfSpeech;

          topDefs.forEach((d) => {
            defsHtml += `
                <div>
                   <span style="color:var(--text-muted); font-weight:500; margin-right:4px; font-size:1 rem; font-style: italic;">${posAbbr}</span>
                   <span>${d.definition}</span>
                </div>
             `;
          });
        });

        defsHtml += `</div>`;
        definitionsContainer.innerHTML = defsHtml;
        definitionsContainer.style.display = 'block';
      }

      // 3. Synonyms
      const synonyms = entry.meanings.flatMap((m) => m.synonyms).slice(0, 5);
      if (synonymsValue) {
        synonymsValue.textContent =
          synonyms.length > 0 ? synonyms.join(', ') : '-';
      }
    } catch (err) {
      console.log('Dictionary data not found:', err);
      // Optional: show a "Not found" message in definitions container?
      if (definitionsContainer) {
        // If we want to hide it completely when not found:
        definitionsContainer.style.display = 'none';
      }
    } finally {
      hideLoading('#card-preview');
      if (definitionsContainer) {
        definitionsContainer.style.minHeight = '';
        // If innerHTML is empty (no defs found or error), hide it
        if (!definitionsContainer.innerHTML) {
          definitionsContainer.style.display = 'none';
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
    await DataService.toggleStar(id, status);
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
            await DataService.deleteCard(id);
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
      }
    );
  },

  renderImportPreview: (data) => {
    const previewData = data.slice(0, 5);
    const importPreviewContainer = $('#import-preview');
    const previewList = $('#preview-list');

    // Update Header with Count
    const sectionLabel = importPreviewContainer.querySelector('.section-label');
    if (sectionLabel) {
      sectionLabel.innerHTML = `Data Preview <span style="font-size:0.9rem; color:var(--text-muted); font-weight:400; margin-left:8px;">(${data.length} vocabularies)</span>`;
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
        const examples = row.example_en || [];

        let examplesHtml = '';
        if (Array.isArray(examples) && examples.length > 0) {
          examplesHtml = `
            <div class="vocab-card-examples" style="font-size: 0.9rem; color: var(--text-muted); padding-top: 8px; width: 100%;">
              ${examples
                .map((ex) => `<div style="margin-bottom: 6px;">• ${ex}</div>`)
                .join('')}
            </div>
          `;
        }

        listHTML += `
          <div class="preview-item">
            <div class="vocab-card-main">
              <div class="vocab-card-word">${word}</div>
              <div class="vocab-card-meaning" style="color: var(--text-main); font-weight: 500;">${meaning}</div>
            </div>
            ${examplesHtml}
          </div>
        `;
      });
      previewList.innerHTML = listHTML;
    }
  },
};

// Start App
App.init();

// Expose App for global handlers
window.App = App;
