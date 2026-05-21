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
  const dialog = $('#modal-dialog');
  document.body.classList.remove('modal-open');
  if (dialog && dialog.open && typeof dialog.close === 'function') {
    dialog.close();
  } else if (dialog) {
    dialog.removeAttribute('open');
  }
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

  const dialog = $('#modal-dialog');
  if (!dialog) return;

  let footerHTML = '';
  if (options.customFooter) {
    footerHTML = options.customFooter;
  } else if (onConfirm) {
    footerHTML = `
      <md-text-button id="modal-cancel-btn">${cancelText}</md-text-button>
      <md-filled-button id="modal-confirm-btn">${confirmText}</md-filled-button>
    `;
  } else if (showClose) {
    footerHTML = `<md-filled-button id="modal-close-btn-footer">${confirmText}</md-filled-button>`;
  }

  dialog.innerHTML = `
        <div slot="headline" class="modal-header">
            <span>${title}</span>
            ${
              showClose
                ? `<md-icon-button class="modal-close-btn" id="modal-close-x" aria-label="Close"><md-icon>close</md-icon></md-icon-button>`
                : ''
            }
        </div>
        <div slot="content" class="modal-body">
            ${content}
        </div>
        <div slot="actions" class="modal-footer ${footerLeft ? 'has-left' : ''}">
            ${footerLeft ? `<div class="modal-footer-left">${footerLeft}</div>` : ''}
            <div class="modal-footer-actions">${footerHTML}</div>
        </div>
    `;

  let confirmed = false;
  const close = () => {
    confirmed = false;
    closeModal();
  };

  if ($('#modal-close-x')) $('#modal-close-x').onclick = close;
  if ($('#modal-close-btn-footer')) $('#modal-close-btn-footer').onclick = close;
  if ($('#modal-cancel-btn')) $('#modal-cancel-btn').onclick = close;

  if ($('#modal-confirm-btn')) {
    $('#modal-confirm-btn').onclick = () => {
      confirmed = true;
      closeModal();
      if (onConfirm) onConfirm();
    };
  }

  dialog.onclose = () => {
    document.body.classList.remove('modal-open');
    if (!confirmed && onCancel) onCancel();
  };

  document.body.classList.add('modal-open');

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else if (typeof dialog.show === 'function') {
    dialog.show();
  } else {
    dialog.setAttribute('open', '');
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

  // Toggle Main Nav visibility (Only show on Dashboard & Words)
  const bottomNav = $('#bottom-nav-container');
  if (bottomNav) {
    if (viewId === 'dashboard' || viewId === 'words') {
      bottomNav.classList.remove('hidden');
    } else {
      bottomNav.classList.add('hidden');
    }
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
