// Utility functions (ES Module).
// The modal is a native <dialog class="dialog">; the loading indicator is a
// CSS spinner (.jw-spinner).

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

export const VIEWPORT = Object.freeze({
  medium: 768,
  expanded: 1024,
  wide: 1440,
});

export const isCompactViewport = () =>
  window.matchMedia(`(max-width: ${VIEWPORT.medium - 1}px)`).matches;

export const on = (element, event, handler) => {
  if (element) {
    element.addEventListener(event, handler);
  }
};

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
      <button type="button" class="btn btn-ghost" id="modal-cancel-btn">${cancelText}</button>
      <button type="button" class="btn btn-primary" id="modal-confirm-btn">${confirmText}</button>
    `;
  } else if (showClose) {
    footerHTML = `<button type="button" class="btn btn-primary" id="modal-close-btn-footer">${confirmText}</button>`;
  }

  dialog.innerHTML = `
        <div class="dialog-title modal-header">
            <span>${title}</span>
            ${
              showClose
                ? `<button type="button" class="btn btn-icon modal-close-btn" id="modal-close-x" aria-label="Close"><i class="ph-bold ph-x" aria-hidden="true"></i></button>`
                : ''
            }
        </div>
        <div class="dialog-body modal-body">
            ${content}
        </div>
        <div class="dialog-actions modal-footer ${footerLeft ? 'has-left' : ''}">
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
  $$('.nav-btn, .nav-item').forEach((el) => {
    el.classList.remove('active');
    el.removeAttribute('active');
    el.setAttribute('aria-selected', 'false');
  });

  const target = $(`#${viewId}`);
  if (target) {
    target.classList.add('active');
  }

  const navElements = $$(
    `.nav-btn[data-target="${viewId}"], .nav-item[data-target="${viewId}"]`,
  );
  navElements.forEach((el) => {
    el.classList.add('active');
    el.setAttribute('active', '');
    el.setAttribute('aria-selected', 'true');
  });

  // Today and Library share a couple of chrome elements (the nav switch,
  // the sign-out/language controls) that only make sense on those two
  // scenes. Each is a single element physically moved into the active
  // scene's own header slot rather than left position:fixed — fixed-over-
  // everything is what made it overlap the header's own controls at
  // narrow widths.
  const moveIntoSlot = (elementSelector, slotByView) => {
    const el = $(elementSelector);
    if (!el) return;
    const slotSelector = slotByView[viewId];
    if (slotSelector) {
      const slot = $(slotSelector);
      if (slot && el.parentElement !== slot) slot.appendChild(el);
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  };

  moveIntoSlot('#bottom-nav-container', {
    dashboard: '#dashboard-nav-slot',
    words: '#words-nav-slot',
  });
  moveIntoSlot('#account-controls', {
    dashboard: '#dashboard-actions-slot',
    words: '#words-actions-slot',
  });

  window.scrollTo(0, 0);
};

export const showLoading = (selector, options = {}) => {
  const container = $(selector);
  if (!container) return;

  const { delay = 0 } = options;

  if (container._loadingTimer) {
    clearTimeout(container._loadingTimer);
    container._loadingTimer = null;
  }

  if (container.querySelector('.loading-overlay')) return;

  const render = () => {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML =
      '<div class="jw-spinner" role="status" aria-label="Loading"></div>';
    container.appendChild(overlay);
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
};
