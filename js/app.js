// Main App Logic (ES Module)
import DataService from './data.js';
import ReviewManager, {
  calculateFamiliarity,
  getFamiliarityLevel,
} from './review.js';
import { $, $$, on, showView, showPopup, closeModal } from './utils.js';
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

  init: async () => {
    App.selectedIds = new Set();
    App.bindEvents();

    const auth = getAuth();

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('User detected:', user.email);
        App.userInfo = user;
        showView('dashboard');
        await App.refreshData();
      } else {
        console.log('No user, showing login');
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
    console.log('[Debug] refreshData: Starting fetch...');
    try {
      const cards = await DataService.fetchCards();
      console.log('[Debug] refreshData: Fetched cards:', cards.length);
      App.allCards = cards;
      App.renderDashboard();
      App.updateDashboardChart();
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
    }
  },

  updateDueCount: () => {
    const scope = $('select[name="scope"]').value; // 'all' or 'starred'
    const now = new Date();

    let baseCards = [...App.allCards];
    if (scope === 'starred') {
      baseCards = baseCards.filter((c) => c.is_starred);
    }

    const dueCards = baseCards.filter((card) => {
      const stats = card.review_stats;
      if (!stats || !stats.next_review_date) return true;

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
    console.log('[Debug] bindEvents: Attaching listeners...');
    // Navigation Interception
    $$('.nav-btn').forEach((btn) => {
      on(btn, 'click', () => {
        const target = btn.getAttribute('data-target');
        console.log('Navigating to:', target);

        // Reset Import View State
        if (target === 'import') {
          $('#import-preview').classList.add('hidden');
          $('#import-actions-container').classList.add('hidden'); // Also hide the external actions
          $('#import-cancel-initial').classList.remove('hidden');
          $('#import-file-section').classList.remove('hidden');
          $('#csv-file-input').value = '';
        }

        if (target === 'dashboard') {
          App.refreshData();
        }

        if (target === 'review-setup') {
          // Reset scope to 'all' on enter or handle based on current selection
          App.updateDueCount();
        }

        showView(target);
      });
    });

    // Handle Review Scope Filter Change
    on($('select[name="scope"]'), 'change', () => {
      App.updateDueCount();
    });

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

      const card = {
        word_en: $('#word_en').value.trim(),
        meaning_zh: $('#meaning_zh').value.trim(),
        example_en: $('#example_en').value.trim(),
        is_starred: $('#is_starred').checked,
      };

      // Duplicate Check (Case-insensitive)
      const isDuplicate = App.allCards.some(
        (c) => c.word_en.toLowerCase() === card.word_en.toLowerCase()
      );

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

      console.log('[Debug] Add Card: Submitting...', card);

      try {
        await DataService.addCard(card);
        e.target.reset();
        await App.refreshData(); // Refresh list
        showPopup(
          'Saved!',
          '<p>New vocabulary card added successfully.</p>',
          true
        );
        showView('dashboard');
      } catch (err) {
        showPopup('Error', `<p>${err.message}</p>`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Card';
      }
    });

    // Dashboard Filters
    on($('#dashboard-starred-toggle'), 'change', () => {
      App.renderDashboard();
    });

    on($('#filter-starred-only'), 'change', () => {
      App.renderDashboard();
    });

    on($('#search-input'), 'input', () => {
      App.renderDashboard();
    });

    on($('#filter-status'), 'change', () => {
      App.renderDashboard();
    });

    // CARD LIST EVENT DELEGATION (New)
    const listContainer = $('#card-list-modern');
    if (listContainer) {
      on(listContainer, 'click', (e) => {
        // 1. Handle Action Buttons (Star, Delete)
        const btn = e.target.closest('button');
        if (btn) {
          const rowEl = btn.closest('.vocab-row');
          if (!rowEl) return;
          const id = rowEl.dataset.id;

          if (btn.classList.contains('btn-star')) {
            const isStarred = btn.dataset.starred === 'true';
            App.toggleStar(id, isStarred);
          } else if (btn.classList.contains('btn-delete')) {
            App.handleDelete(id);
          }
          return;
        }

        // 2. Ignore Checkbox interactions (don't trigger preview)
        if (e.target.closest('.checkbox-col')) {
          return;
        }

        // 3. Handle Card Preview Click (bubble up) - Anywhere else in the row
        const row = e.target.closest('.vocab-row');
        if (row) {
          const id = row.dataset.id;
          App.showCardPreview(id);
        }
      });
    }

    // Start Review Button
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

      let cardsToReview = [...App.allCards];
      if (scope === 'starred') {
        cardsToReview = cardsToReview.filter((c) => c.is_starred);
      }

      // SRS Filtering: Only include DUE cards if toggle is ON
      if (dueOnly) {
        const now = new Date();
        cardsToReview = cardsToReview.filter((card) => {
          const stats = card.review_stats;
          if (!stats || !stats.next_review_date) return true;

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
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target.result;
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
              newRow.example_en = row[key];
            } else {
              newRow[key] = row[key]; // Keep original for preview
            }
          });
          return newRow;
        });

        pendingImportData = normalizedData;
        App.renderImportPreview(normalizedData);
      };
      reader.readAsText(file); // Read as text for CSV
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
        $('#import-actions-container').classList.add('hidden');
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

    // --- Batch Action Events ---
    // 1. Select All Button
    on($('#select-all-btn'), 'click', () => {
      const visibleCheckboxes = $$('.row-checkbox');
      const allSelected = Array.from(visibleCheckboxes).every(
        (cb) => cb.checked
      );

      const shouldSelect = !allSelected;
      visibleCheckboxes.forEach((cb) => {
        cb.checked = shouldSelect;
        const id = cb.dataset.id;
        if (shouldSelect) App.selectedIds.add(id);
        else App.selectedIds.delete(id);
      });

      App.updateBatchUI();
    });

    // 2. Individual Checkbox Delegation
    if (listContainer) {
      on(listContainer, 'change', (e) => {
        if (e.target.classList.contains('row-checkbox')) {
          const id = e.target.dataset.id;
          if (e.target.checked) App.selectedIds.add(id);
          else App.selectedIds.delete(id);

          App.updateBatchUI();
        }
      });
    }

    // 3. Batch Delete Action
    on($('#batch-delete-btn'), 'click', () => {
      const count = App.selectedIds.size;
      if (count === 0) return;

      showPopup(
        'Batch Delete',
        `<p>Are you sure you want to delete <b>${count}</b> selected cards? This cannot be undone.</p>`,
        {
          confirmText: `Delete ${count}`,
          onConfirm: async () => {
            try {
              const btn = $('#batch-delete-btn');
              btn.disabled = true;
              btn.textContent = 'Deleting...';

              await DataService.batchDeleteCards(Array.from(App.selectedIds));
              App.selectedIds.clear();
              App.updateBatchUI(); // Hide bar immediately

              await App.refreshData();
              showPopup(
                'Success',
                `<p>${count} cards deleted successfully.</p>`
              );
            } catch (err) {
              showPopup('Error', '<p>Failed to perform batch delete.</p>');
              console.error(err);
            } finally {
              $('#batch-delete-btn').disabled = false;
              $('#batch-delete-btn').innerHTML =
                '<span class="material-icons" style="font-size: 18px; margin-right: 4px;">delete</span> Delete Selected';
            }
          },
        }
      );
    });

    // 4. Progress Chart Trigger (Hidden as it's now inline)
    /*
    on($('#total-progress-card'), 'click', () => {
      App.showProgressChart();
    });
    */

    // 5. Cancel Batch Mode
    on($('#cancel-batch-btn'), 'click', () => {
      App.selectedIds.clear();
      App.renderDashboard(); // This will call updateBatchUI and uncheck boxes
    });
  },

  renderDashboard: () => {
    // Determine which cards to aggregate for dashboard stats
    const isGlobalStarredOnly =
      $('#dashboard-starred-toggle') && $('#dashboard-starred-toggle').checked;
    const dashboardCards = isGlobalStarredOnly
      ? App.allCards.filter((c) => c.is_starred)
      : App.allCards;

    // Stats
    $('#total-count').textContent = dashboardCards.length;

    // Advanced Stats Calculation
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let dueTotal = 0,
      dueNew = 0,
      dueLrn = 0,
      dueMst = 0;
    let learningLoad = 0;
    let masteredTotal = 0;
    let demotions30d = 0;

    dashboardCards.forEach((card) => {
      const stats = card.review_stats || {};
      const state = stats.state || 'NEW';

      // Due Calculation
      let isDue = false;
      if (!stats.next_review_date) {
        isDue = true;
      } else {
        const nextDate = stats.next_review_date.toDate
          ? stats.next_review_date.toDate()
          : new Date(stats.next_review_date);
        if (nextDate <= now) isDue = true;
      }

      if (isDue) {
        dueTotal++;
        if (state === 'NEW') dueNew++;
        else if (state === 'LEARNING') dueLrn++;
        else if (state === 'MASTERED') dueMst++;
      }

      // Learning Load
      if (state === 'LEARNING') learningLoad++;

      // Mastered Quality
      if (state === 'MASTERED') masteredTotal++;

      // Demotions (30d)
      if (stats.demotions && Array.isArray(stats.demotions)) {
        stats.demotions.forEach((d) => {
          const dDate = new Date(d);
          if (dDate >= thirtyDaysAgo) demotions30d++;
        });
      }
    });

    // Update Dashboard DOM
    const elDueCount = $('#due-count');
    if (elDueCount) {
      elDueCount.textContent = dueTotal;
      // In black card, we might not want it RED if it's white text,
      // but let's keep the logic or adjust it.
      // If it's a dark card, maybe we want a highlight instead.
      // For now, let's just update the text.
    }
    if ($('#due-new')) $('#due-new').textContent = dueNew;
    if ($('#due-lrn')) $('#due-lrn').textContent = dueLrn;
    if ($('#due-mst')) $('#due-mst').textContent = dueMst;

    if ($('#learning-load-count'))
      $('#learning-load-count').textContent = learningLoad;
    if ($('#mastered-count')) $('#mastered-count').textContent = masteredTotal;
    if ($('#demoted-30d-count'))
      $('#demoted-30d-count').textContent = demotions30d;

    // List rendering
    const container = $('#card-list-modern');
    if (!container) return; // Fallback if view not active

    // Get filter values
    const showStarredOnly = $('#filter-starred-only').checked;
    const searchQuery = $('#search-input').value.toLowerCase().trim();
    const statusFilter = $('#filter-status').value;

    // Apply filtering
    const filteredCards = App.allCards.filter((card) => {
      // Starred filter
      if (showStarredOnly && !card.is_starred) return false;

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

      return true;
    });

    // Pagination Logic
    App.lastFilteredCount = filteredCards.length;
    const ITEMS_PER_PAGE = 15;
    const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE) || 1;

    // Ensure current page is valid
    if (App.currentPage > totalPages) App.currentPage = totalPages;
    if (App.currentPage < 1) App.currentPage = 1;

    const startIdx = (App.currentPage - 1) * ITEMS_PER_PAGE;
    const pagedCards = filteredCards.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    // Update Pagination UI
    const paginationEl = $('#pagination-controls');
    if (paginationEl) {
      if (filteredCards.length > 0) {
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
      <div class="table-responsive">
        <table class="vocab-table">
          <thead>
            <tr>
              <th class="checkbox-col"></th>
              <th>Word</th>
              <th class="desktop-only">Meaning</th>
              <th>Status</th>
              <th class="desktop-only" style="width: 100px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="vocab-table-body"></tbody>
        </table>
      </div>
    `;

    const tbody = $('#vocab-table-body');
    if (filteredCards.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; padding: 3rem; color: var(--text-muted);">No vocabulary found.</td></tr>';
      return;
    }

    pagedCards.forEach((card) => {
      const level = getFamiliarityLevel(card.review_stats);

      const row = document.createElement('tr');
      row.className = 'vocab-row';
      row.dataset.id = card.id;

      row.innerHTML = `
        <td class="checkbox-col">
          <div class="inline-flex items-center">
            <label class="flex items-center cursor-pointer relative" for="check-${
              card.id
            }">
              <input type="checkbox"
                id="check-${card.id}"
                class="row-checkbox peer h-5 w-5 cursor-pointer transition-all appearance-none rounded border border-slate-300 checked:bg-accent-orange checked:border-accent-orange"
                data-id="${card.id}"
                ${
                  App.selectedIds && App.selectedIds.has(card.id)
                    ? 'checked'
                    : ''
                } />
              <span class="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </span>
            </label>
          </div>
        </td>
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
        <td class="vocab-table-actions desktop-only">
          <button class="icon-btn btn-star ${
            card.is_starred ? 'starred' : ''
          }" data-starred="${card.is_starred}">
            <span class="material-icons" style="font-size:20px;">${
              card.is_starred ? 'star' : 'star_border'
            }</span>
          </button>
          <button class="icon-btn btn-delete">
            <span class="material-icons" style="font-size:20px;">delete_outline</span>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    App.updateBatchUI();
  },

  updateBatchUI: () => {
    const bar = $('#batch-action-bar');
    const filterControls = $('.filter-controls-flex');
    const countText = $('#selected-count-text');
    const count = App.selectedIds.size;

    if (count > 0) {
      if (bar) bar.classList.remove('hidden');
      if (filterControls) filterControls.classList.add('hidden');
      if (countText) countText.textContent = `${count} selected`;

      // Update Select All button text
      const btn = $('#select-all-btn');
      if (btn) {
        const allVisible = $$('.row-checkbox');
        const allChecked =
          allVisible.length > 0 &&
          Array.from(allVisible).every((cb) => cb.checked);
        btn.innerHTML = allChecked
          ? '<span class="material-icons" style="font-size: 18px; margin-right: 4px;">deselect</span> Deselect All'
          : '<span class="material-icons" style="font-size: 18px; margin-right: 4px;">done_all</span> Select All';
      }
    } else {
      if (bar) bar.classList.add('hidden');
      if (filterControls) filterControls.classList.remove('hidden');
    }
  },

  showCardPreview: (id) => {
    const card = App.allCards.find((c) => c.id === id);
    if (!card) return;

    const level = getFamiliarityLevel(card.review_stats);

    const html = `
        <div style="text-align:center; padding-top:1rem;">
            <div style="font-size:2.5rem; font-weight:800; letter-spacing:-0.03em;">${
              card.word_en
            }</div>
            <div style="font-size:1.25rem; color:var(--text-muted); margin-bottom:1.5rem;">${
              card.meaning_zh
            }</div>

            <div style="background:var(--bg-workspace); padding:1.5rem; border-radius:20px; text-align:left; margin-bottom:1.5rem;">
                <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:0.5rem;">Example Sentence</div>
                <div style="font-size:1.1rem; line-height:1.5;">${
                  card.example_en || '<i>No example provided.</i>'
                }</div>
            </div>

            <div style="display:flex; gap:1rem;">
                <div class="status-badge-container status-${level.label.toLowerCase()}">
                    <div class="status-label">STATUS</div>
                    <div class="status-value">${level.label.toUpperCase()}</div>
                </div>
                <div style="flex:1; background:#f4f4f4; padding:1rem; border-radius:1rem;">
                    <div style="font-size:0.7rem; color:#666; font-weight:700; margin-bottom:4px;">ATTEMPTS</div>
                    <div style="font-weight:800; color:#1a1a1a;">${
                      card.review_stats.total_attempts || 0
                    }</div>
                </div>
            </div>
        </div>
    `;

    const footerLeft = `
      <button class="icon-btn preview-star-btn ${
        card.is_starred ? 'starred' : ''
      }"
              style="color: ${
                card.is_starred ? '#fbbf24' : '#666'
              }; background: none; border: none; padding: 0.5rem; display: flex; align-items: center; justify-content: center;">
          <span class="material-icons" style="font-size:24px;">${
            card.is_starred ? 'star' : 'star_border'
          }</span>
      </button>
      <button class="icon-btn preview-delete-btn"
              style="color: #ef4444; background: none; border: none; padding: 0.5rem; display: flex; align-items: center; justify-content: center;">
          <span class="material-icons" style="font-size:24px;">delete_outline</span>
      </button>
    `;

    showPopup('Card Detail', html, { footerLeft });

    // Bind popup actions
    setTimeout(() => {
      const starBtn = $('.preview-star-btn');
      const deleteBtn = $('.preview-delete-btn');

      if (starBtn) {
        on(starBtn, 'click', async (e) => {
          e.stopPropagation();
          await App.toggleStar(card.id, card.is_starred);
          // Refresh popup
          App.showCardPreview(card.id);
        });
      }

      if (deleteBtn) {
        on(deleteBtn, 'click', async (e) => {
          e.stopPropagation();
          App.handleDelete(card.id);
        });
      }
    }, 100);
  },

  // Exposed for onclick handlers
  toggleStar: async (id, status) => {
    // Optimistic update
    const card = App.allCards.find((c) => c.id === id);
    if (card) {
      card.is_starred = !status;
      App.renderDashboard();
    }
    await DataService.toggleStar(id, status);
    // No need to full refresh for star, optimistic is fine.
  },

  handleDelete: async (id) => {
    console.log('[Debug] handleDelete: id=', id);
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
          } catch (err) {
            showPopup('Error', 'Failed to delete card.');
            console.error(err);
          }
        },
      }
    );
  },

  updateDashboardChart: () => {
    const canvas = document.getElementById('dashboard-progress-chart');
    if (!canvas) return;

    const data = App.processChartData(App.allCards);
    if (data.labels.length === 0) return;

    // Destroy existing chart instance if it exists
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Total Words',
            data: data.totalCounts,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.05)',
            borderWidth: 3,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#f97316',
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Mastered',
            data: data.masteredCounts,
            borderColor: '#27ae60',
            backgroundColor: 'rgba(39, 174, 96, 0.05)',
            borderWidth: 3,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#27ae60',
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 6,
              boxHeight: 6,
              generateLabels(chart) {
                const labels =
                  Chart.defaults.plugins.legend.labels.generateLabels(chart);

                labels.forEach((l) => {
                  l.fillStyle = l.strokeStyle;
                  l.lineWidth = 0;
                  l.pointStyle = 'circle';
                  l.boxWidth = 12;
                  l.boxHeight = 6;
                });

                return labels;
              },

              font: { size: 11, weight: '600' },
              padding: 20,
            },
          },
          tooltip: {
            // enabled: false,
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            titleColor: '#1a1a1a',
            bodyColor: '#666',
            borderColor: '#eee',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            usePointStyle: true,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f0f0f0', drawBorder: false },
            ticks: {
              stepSize: 1,
              color: '#999',
              font: { size: 10 },
              padding: 8,
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#999',
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 7,
              padding: 8,
            },
          },
        },
      },
    });
  },

  processChartData: (cards) => {
    if (!cards || cards.length === 0)
      return { labels: [], totalCounts: [], masteredCounts: [] };

    const eventMap = {}; // { 'YYYY-MM-DD': { added: 0, mastered: 0 } }

    const getLocalDate = (rawDate) => {
      const d = rawDate?.toDate
        ? rawDate.toDate()
        : rawDate
        ? new Date(rawDate)
        : new Date();

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 1. Map all events to their dates
    cards.forEach((card) => {
      // Created Date
      const dateKey = getLocalDate(card.created_at);
      if (!eventMap[dateKey]) eventMap[dateKey] = { added: 0, mastered: 0 };
      eventMap[dateKey].added += 1;

      // Mastered Date
      if (card.review_stats?.state === 'MASTERED') {
        const mKey = getLocalDate(
          card.review_stats.mastered_at ||
            card.review_stats.last_reviewed_at ||
            card.created_at
        );
        if (!eventMap[mKey]) eventMap[mKey] = { added: 0, mastered: 0 };
        eventMap[mKey].mastered += 1;
      }
    });

    const sortedDates = Object.keys(eventMap).sort();
    if (sortedDates.length === 0)
      return { labels: [], totalCounts: [], masteredCounts: [] };

    // 2. Determine Range (First Event -> Today)
    const startDate = new Date(sortedDates[0]);
    const endDate = new Date(); // Today
    // Reset times to compare dates only
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const finalLabels = [];
    const totalCounts = [];
    const masteredCounts = [];

    let currentTotal = 0;
    let currentMastered = 0;

    // 3. Iterate day by day
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      if (eventMap[dateStr]) {
        currentTotal += eventMap[dateStr].added;
        currentMastered += eventMap[dateStr].mastered;
      }

      finalLabels.push(dateStr);
      totalCounts.push(currentTotal);
      masteredCounts.push(currentMastered);
    }

    return { labels: finalLabels, totalCounts, masteredCounts };
  },

  renderImportPreview: (data) => {
    const previewData = data.slice(0, 5);
    const importPreviewContainer = $('#import-preview');
    const previewTable = $('#preview-table');

    if (importPreviewContainer) {
      importPreviewContainer.classList.remove('hidden');
      $('#import-actions-container').classList.remove('hidden'); // Show external actions
      $('#import-cancel-initial').classList.add('hidden');
      $('#import-file-section').classList.add('hidden');
    }

    // Headers
    if (previewData.length > 0) {
      const keys = Object.keys(previewData[0]);
      let headerHTML = '<tr>';
      keys.forEach((k) => (headerHTML += `<th>${k}</th>`));
      headerHTML += '</tr>';

      let bodyHTML = '';
      previewData.forEach((row) => {
        bodyHTML += '<tr>';
        keys.forEach((k) => (bodyHTML += `<td>${row[k] || ''}</td>`));
        bodyHTML += '</tr>';
      });
      previewTable.innerHTML = headerHTML + bodyHTML;
    }
  },
};

// Start App
App.init();

// Expose App for global handlers
window.App = App;
