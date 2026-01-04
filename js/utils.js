// Utility functions (ES Module)

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

// Simple event listener wrapper
export const on = (element, event, handler) => {
  if (element) {
    element.addEventListener(event, handler);
  }
};

// Toggle visibility of views
export const closeModal = () => {
  const overlay = $('#modal-overlay');
  if (overlay) overlay.style.display = 'none';
};

export const showPopup = (title, content, options = {}) => {
  const {
    showClose = true,
    onConfirm = null,
    onCancel = null,
    confirmText = 'Got it',
    cancelText = 'Cancel',
    footerLeft = null,
  } = options;

  const contentArea = $('#modal-content');
  if (!contentArea) return;

  let footerHTML = '';
  if (options.customFooter) {
    footerHTML = options.customFooter;
  } else if (onConfirm) {
    footerHTML = `
      <button class="btn btn-tonal" id="modal-cancel-btn">${cancelText}</button>
      <button class="btn btn-primary" id="modal-confirm-btn">${confirmText}</button>
    `;
  } else if (showClose) {
    footerHTML = `<button class="btn btn-primary" id="modal-close-btn-footer">${confirmText}</button>`;
  }

  contentArea.innerHTML = `
        <div class="modal-header">
            <h2 style="font-size: 1.25rem; font-weight: 800; letter-spacing:-0.02em;">${title}</h2>
            ${
              showClose
                ? `<button class="modal-close-btn" id="modal-close-x"><span class="material-icons">close</span></button>`
                : ''
            }
        </div>
        <div class="modal-body">
            ${content}
        </div>
        <div class="modal-footer ${footerLeft ? 'has-left' : ''}">
            <div class="modal-footer-left">${footerLeft || ''}</div>
            <div class="modal-footer-right">${footerHTML}</div>
        </div>
    `;

  const overlay = $('#modal-overlay');
  if (overlay) {
    overlay.style.display = 'flex';

    // Helper to close and cleanup
    const close = () => {
      overlay.style.display = 'none';
      if (onCancel) onCancel();
    };

    // Bind Close Actions
    if ($('#modal-close-x')) $('#modal-close-x').onclick = close;
    if ($('#modal-close-btn-footer'))
      $('#modal-close-btn-footer').onclick = close;
    if ($('#modal-cancel-btn')) $('#modal-cancel-btn').onclick = close;

    if ($('#modal-confirm-btn')) {
      $('#modal-confirm-btn').onclick = () => {
        overlay.style.display = 'none';
        if (onConfirm) onConfirm();
      };
    }

    // Close on background click
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };
  }
};

export const showView = (viewId) => {
  $$('.view').forEach((el) => el.classList.remove('active'));
  $$('.nav-btn, .nav-item').forEach((el) => el.classList.remove('active'));

  const target = $(`#${viewId}`);
  if (target) {
    target.classList.add('active');
  }

  const navElements = $$(
    `.nav-btn[data-target="${viewId}"], .nav-item[data-target="${viewId}"]`
  );
  navElements.forEach((el) => {
    el.classList.add('active');
  });

  // Icon Swapping Logic for Bottom Nav
  $$('.nav-item').forEach((el) => {
    const icon = el.querySelector('.nav-icon');
    if (icon && icon.dataset.iconDefault && icon.dataset.iconActive) {
      if (el.classList.contains('active')) {
        icon.src = icon.dataset.iconActive;
      } else {
        icon.src = icon.dataset.iconDefault;
      }
    }
  });

  // Dashboard specific: hide mobile bottom actions
  const mobileActions = $('#mobile-bottom-actions');
  if (mobileActions) {
    if (viewId === 'dashboard') {
      mobileActions.classList.add('hidden');
    } else {
      mobileActions.classList.remove('hidden');
    }
  }

  // Toggle Main Nav visibility (Only show on Dashboard & Words)
  const bottomNav = $('#bottom-nav-container');
  if (bottomNav) {
    if (viewId === 'dashboard' || viewId === 'words') {
      bottomNav.classList.remove('hidden');
    } else {
      bottomNav.classList.add('hidden');
    }
  }

  // Context FAB Logic
  const fabReview = $('#fab-review');
  const fabAdd = $('#fab-add-card');

  if (fabReview) fabReview.classList.add('hidden');
  if (fabAdd) fabAdd.classList.add('hidden');

  if (viewId === 'dashboard' && fabReview) {
    fabReview.classList.remove('hidden');
  } else if (viewId === 'words' && fabAdd) {
    fabAdd.classList.remove('hidden');
  }
};

// Loading Animation Helper
export const showLoading = (selector, options = {}) => {
  const container = $(selector);
  if (!container) return;

  const { delay = 0 } = options;

  // Clear any pending timer on this container to restart or just ensure clean slate
  if (container._loadingTimer) {
    clearTimeout(container._loadingTimer);
    container._loadingTimer = null;
  }

  // Prevent multiple overlays
  if (container.querySelector('.loading-overlay')) return;

  const render = () => {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="lottie-container"></div>';
    container.appendChild(overlay);

    // Ensure Lottie is loaded
    if (window.lottie) {
      window.lottie.loadAnimation({
        container: overlay.querySelector('.lottie-container'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'assets/loading.json',
      });
    }
  };

  if (delay > 0) {
    container._loadingTimer = setTimeout(() => {
      render();
      container._loadingTimer = null;
    }, delay);
  } else {
    render();
  }
};

export const hideLoading = (selector) => {
  const container = $(selector);
  if (!container) return;

  if (container._loadingTimer) {
    clearTimeout(container._loadingTimer);
    container._loadingTimer = null;
  }

  const overlay = container.querySelector('.loading-overlay');
  if (overlay) {
    overlay.remove();
  }
};

window.utils = {
  $,
  $$,
  on,
  showView,
  showPopup,
  closeModal,
  showLoading,
  hideLoading,
}; // Keep global for debugging if needed, or remove
