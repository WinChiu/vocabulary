// UI markup generators — "Field Notes" edition.
// Plain HTML carrying the app.css component classes. Icons are Phosphor
// bold weight (`.ph-bold .ph-*`); state (e.g. starred) is signalled with
// color via the `.starred` class rather than swapping icon glyphs.

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

// Phosphor duotone glyph. `name` is the icon name without the `ph-` prefix.
const renderIcon = (name) =>
  `<i class="ph-bold ph-${escapeHtml(name)}" aria-hidden="true"></i>`;

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
    : renderIcon(icon);

  return `<button type="button" class="btn btn-icon ${escapeHtml(
    className,
  )}" aria-label="${escapeHtml(
    ariaLabel || icon || imageAlt,
  )}"${dataAttrs}>${content}</button>`;
};

const renderStarButton = (card) => {
  const active = isStarred(card);
  return renderIconButton({
    className: `btn-star ${active ? 'starred' : ''}`.trim(),
    icon: 'star',
    ariaLabel: active
      ? `Remove star from ${card.word_en}`
      : `Star ${card.word_en}`,
    dataset: { starred: String(active) },
  });
};

const renderRowActions = (card) => `
  ${renderStarButton(card)}
  ${renderIconButton({ className: 'btn-edit', icon: 'pencil-simple', ariaLabel: `Edit ${card.word_en}` })}
  ${renderIconButton({ className: 'btn-delete', icon: 'trash', ariaLabel: `Delete ${card.word_en}` })}
`;

const renderStatusBadge = (level) =>
  `<span class="level-indicator ${escapeHtml(level.class)}">${escapeHtml(
    level.label,
  )}</span>`;

const renderCategoryPill = (category) =>
  category ? `<span class="category-pill">${escapeHtml(category)}</span>` : '';

export const renderEmptyState = (message) =>
  `<div class="empty-state">${escapeHtml(message)}</div>`;

// Broadsheet prints data tables with `.table`; row rules are the hairline.
export const renderVocabularyTableShell = () => `
  <div class="table-responsive">
    <table class="table vocab-table">
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
  <ul class="jw-list vocab-list-modern" aria-label="Vocabulary words"></ul>
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
    'li',
    'vocab-list-item',
    { id: card.id },
    `
      <div class="vocab-list-item-main">
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
    <label class="field">
      <textarea
        rows="2"
        placeholder="${escapeHtml(placeholder)}"
        aria-label="Example sentence"
        class="input example-input"
      ></textarea>
    </label>
  </div>
  <button type="button" class="btn btn-icon btn-remove-example" aria-label="Remove example">
    ${renderIcon('x')}
  </button>
`;

export const renderPreviewSection = (label, items) => {
  const normalizedItems = Array.isArray(items) ? items : [items];
  const content = normalizedItems
    .filter((item) => String(item || '').trim().length > 0)
    .map(
      (item) => `
        <li class="preview-content-list-item">
          <div class="preview-list-body">${escapeHtml(item)}</div>
        </li>
      `,
    )
    .join('');

  if (!content) return '';

  return `
    <div class="preview-section">
      <div class="preview-section-label">${escapeHtml(label)}</div>
      <ul class="jw-list preview-content-list" aria-label="${escapeHtml(label)}">
        ${content}
      </ul>
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
    <section class="preview-hero">
      <div class="preview-title">${escapeHtml(card.word_en)}</div>
      <div class="preview-meaning">${escapeHtml(card.meaning_zh)}</div>
      <div class="preview-status-row">
        <span class="level-indicator ${escapeHtml(
          level.class,
        )} preview-status-chip">${escapeHtml(level.label)}</span>
        ${renderCategoryPill(card.category)}
      </div>
      ${dictionaryMetrics}
    </section>

    ${noteSection}
    ${exampleSection}
    ${dictionarySections}
  </div>
`;

export const renderImportPreviewItem = ({ word, category }) => `
    <li class="vocab-list-item import-preview-card">
      <div class="vocab-card-word">${escapeHtml(word)}</div>
      <div class="vocab-list-item-meta">${renderCategoryPill(category)}</div>
    </li>
  `;
