export const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const isStarred = (card) =>
  card.is_starred === true || String(card.is_starred) === 'true';

const createElement = (tagName, className, dataset = {}, innerHTML = '') => {
  const element =
    typeof document !== 'undefined'
      ? document.createElement(tagName)
      : { dataset: {}, className: '', innerHTML: '' };

  element.className = className;
  Object.entries(dataset).forEach(([key, value]) => {
    element.dataset[key] = value;
  });
  element.innerHTML = innerHTML;
  return element;
};

const renderMaterialIcon = (name) =>
  `<span class="material-symbols-rounded">${escapeHtml(name)}</span>`;

const renderIconButton = ({
  className = '',
  icon,
  imageSrc,
  imageAlt = '',
  dataset = {},
} = {}) => {
  const dataAttrs = Object.entries(dataset)
    .map(([key, value]) => ` data-${escapeHtml(key)}="${escapeHtml(value)}"`)
    .join('');
  const content = imageSrc
    ? `<img src="${escapeHtml(imageSrc)}" class="action-icon" alt="${escapeHtml(
        imageAlt,
      )}" />`
    : renderMaterialIcon(icon);

  return `<button type="button" class="icon-button ${escapeHtml(
    className,
  )}"${dataAttrs}>${content}</button>`;
};

const renderStarButton = (card) => {
  const active = isStarred(card);
  return renderIconButton({
    className: `btn-star ${active ? 'starred' : ''}`.trim(),
    imageSrc: active ? 'assets/star-filled.svg' : 'assets/star.svg',
    imageAlt: 'star',
    dataset: { starred: String(active) },
  });
};

const renderRowActions = (card) => `
  ${renderStarButton(card)}
  ${renderIconButton({ className: 'btn-edit', icon: 'edit' })}
  ${renderIconButton({ className: 'btn-delete', icon: 'delete' })}
`;

const renderStatusBadge = (level) =>
  `<span class="level-indicator ${escapeHtml(level.class)}">${escapeHtml(
    level.label,
  )}</span>`;

const renderCategoryPill = (category) =>
  category ? `<span class="category-pill">${escapeHtml(category)}</span>` : '';

export const renderEmptyState = (message) =>
  `<div class="empty-state">${escapeHtml(message)}</div>`;

export const renderVocabularyTableShell = () => `
  <div class="table-responsive">
    <table class="vocab-table">
      <thead>
        <tr>
          <th>單字</th>
          <th class="desktop-only">Meaning</th>
          <th>狀態</th>
          <th class="actions-col">Actions</th>
        </tr>
      </thead>
      <tbody id="vocab-table-body"></tbody>
    </table>
  </div>
  <div class="vocab-list-modern"></div>
`;

export const createVocabularyTableRow = (card, level) =>
  createElement(
    'tr',
    'vocab-row',
    { id: card.id },
    `
      <td>
        <div class="vocab-table-word">${escapeHtml(card.word_en)}</div>
        <div class="mobile-meaning">${escapeHtml(card.meaning_zh)}</div>
      </td>
      <td class="desktop-only">
        <div class="vocab-table-meaning">${escapeHtml(card.meaning_zh)}</div>
      </td>
      <td>${renderStatusBadge(level)}</td>
      <td class="vocab-table-actions">${renderRowActions(card)}</td>
    `,
  );

export const createVocabularyCard = (card, level) =>
  createElement(
    'div',
    'vocab-card-modern',
    { id: card.id },
    `
      <div class="vocab-card-main">
        <div class="vocab-card-word">${escapeHtml(card.word_en)}</div>
        <div class="vocab-card-meaning">${escapeHtml(card.meaning_zh)}</div>
      </div>
      <div class="vocab-card-side">
        ${renderStatusBadge(level)}
        <div class="vocab-card-actions">${renderRowActions(card)}</div>
      </div>
    `,
  );

export const renderExampleInput = (placeholder) => `
  <label class="form-field form-field-textarea example-field">
    <textarea
      rows="2"
      placeholder="${escapeHtml(placeholder)}"
      class="example-input form-control form-textarea"
    ></textarea>
  </label>
  <md-icon-button type="button" class="btn-remove-example" aria-label="Remove example">
    <md-icon>close</md-icon>
  </md-icon-button>
`;

export const renderPreviewSection = (label, items) => {
  const normalizedItems = Array.isArray(items) ? items : [items];
  const content = normalizedItems
    .filter((item) => String(item || '').trim().length > 0)
    .map((item) => `<div>${escapeHtml(item)}</div>`)
    .join('');

  if (!content) return '';

  return `
    <div class="preview-section">
      <div class="preview-section-label">${escapeHtml(label)}</div>
      <div class="preview-section-content">${content}</div>
    </div>
  `;
};

export const renderPreviewPage = ({
  card,
  level,
  noteSection,
  exampleSection,
  dictionaryMetrics = '',
  dictionarySections = '',
}) => `
  <div class="preview-page">
    <div>
      <div class="preview-title">${escapeHtml(card.word_en)}</div>
      <div class="preview-meaning">${escapeHtml(card.meaning_zh)}</div>
    </div>

    <div class="preview-metrics">
      <div class="status-badge-container status-${escapeHtml(
        level.label.toLowerCase(),
      )}">
        <div class="status-label">Status</div>
        <div class="status-value">${escapeHtml(level.label.toUpperCase())}</div>
      </div>
      ${dictionaryMetrics}
    </div>

    ${noteSection}
    ${exampleSection}
    ${dictionarySections}
  </div>
`;

export const renderImportPreviewItem = ({ word, category }) => `
    <div class="vocab-card-modern import-preview-card">
      <div class="import-preview-card-row">
        <div class="vocab-card-word">${escapeHtml(word)}</div>
        ${renderCategoryPill(category)}
      </div>
    </div>
  `;
