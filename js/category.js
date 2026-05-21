export const UNCATEGORIZED_FILTER_VALUE = '__uncategorized';

export const normalizeCategory = (category) => String(category || '').trim();

export const buildCategoryOptions = (cards) => {
  const categories = new Set();

  cards.forEach((card) => {
    const category = normalizeCategory(card.category);
    if (category) categories.add(category);
  });

  return Array.from(categories).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
};

export const categoryMatchesFilter = (card, filterValue = 'all') => {
  if (!filterValue || filterValue === 'all') return true;

  const category = normalizeCategory(card.category);
  if (filterValue === UNCATEGORIZED_FILTER_VALUE) return !category;

  return category === filterValue;
};
