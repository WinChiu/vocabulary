const getCreatedTime = (value) => {
  if (!value) return 0;
  return value.toDate ? value.toDate().getTime() : new Date(value).getTime();
};

const getStatusRank = (card) => {
  const state = card?.review_stats?.state;
  if (state === 'NEW') return 0;
  if (state === 'LEARNING') return 1;
  if (state === 'MASTERED') return 2;
  return 0;
};

const byNewest = (a, b) => {
  const timeDiff = getCreatedTime(b.created_at) - getCreatedTime(a.created_at);
  if (timeDiff !== 0) return timeDiff;
  return (a.id || '').localeCompare(b.id || '');
};

const byWord = (direction) => (a, b) => {
  const wordDiff = (a.word_en || '').localeCompare(b.word_en || '', undefined, {
    sensitivity: 'base',
  });
  if (wordDiff !== 0) return direction === 'desc' ? -wordDiff : wordDiff;
  return byNewest(a, b);
};

const byStatus = (a, b) => {
  const statusDiff = getStatusRank(a) - getStatusRank(b);
  if (statusDiff !== 0) return statusDiff;
  return byNewest(a, b);
};

export const sortVocabularyCards = (cards, sortOrder = 'newest') => {
  const sortedCards = [...cards];
  if (sortOrder === 'az') return sortedCards.sort(byWord('asc'));
  if (sortOrder === 'za') return sortedCards.sort(byWord('desc'));
  if (sortOrder === 'status') return sortedCards.sort(byStatus);
  return sortedCards.sort(byNewest);
};
