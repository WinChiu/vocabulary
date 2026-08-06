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

const renderMaterialIcon = (name) => `<md-icon>${escapeHtml(name)}</md-icon>`;

const renderIconButton = ({
  className = '',
  icon,
  imageSrc,
  imageAlt = '',
  ariaLabel,
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

  return `<md-icon-button type="button" class="icon-button ${escapeHtml(
    className,
  )}" aria-label="${escapeHtml(ariaLabel || icon || imageAlt)}"${dataAttrs}>${content}</md-icon-button>`;
};

const renderStarButton = (card) => {
  const active = isStarred(card);
  return renderIconButton({
    className: `btn-star ${active ? 'starred' : ''}`.trim(),
    icon: active ? 'star' : 'star_outline',
    ariaLabel: active ? `Remove star from ${card.word_en}` : `Star ${card.word_en}`,
    dataset: { starred: String(active) },
  });
};

const renderRowActions = (card) => `
  ${renderStarButton(card)}
  ${renderIconButton({ className: 'btn-edit', icon: 'edit', ariaLabel: `Edit ${card.word_en}` })}
  ${renderIconButton({ className: 'btn-delete', icon: 'delete', ariaLabel: `Delete ${card.word_en}` })}
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
          <th>Word</th>
          <th class="desktop-only">Meaning</th>
          <th>Status</th>
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
      <div class="vocab-list-item-content">
        <div class="vocab-card-word">${escapeHtml(card.word_en)}</div>
        <div class="vocab-card-meaning">${escapeHtml(card.meaning_zh)}</div>
      </div>
      <div class="vocab-list-item-meta">
        ${renderStatusBadge(level)}
        <div class="vocab-card-actions">${renderRowActions(card)}</div>
      </div>
    `,
  );

export const renderExampleInput = (placeholder) => `
  <div class="example-field">
    <md-outlined-text-field
      type="textarea"
      rows="2"
      placeholder="${escapeHtml(placeholder)}"
      class="example-input material-field"
    ></md-outlined-text-field>
  </div>
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
      <div class="vocab-card-row vocab-card-row-primary">
        <div class="vocab-card-word">${escapeHtml(word)}</div>
        ${renderCategoryPill(category)}
      </div>
    </div>
  `;
