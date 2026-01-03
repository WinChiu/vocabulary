// Data Layer - Firebase Modular SDK
import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  orderBy,
  query,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const COLLECTION_NAME = 'cards';

const INITIAL_STATS = () => ({
  state: 'NEW', // NEW, LEARNING, MASTERED
  success_streak: 0,
  interval_days: 0,
  next_review_date: null,
  mastered_at: null,
  demotions: [], // Array of timestamps for Mastered -> Learning transitions
  total_attempts: 0,
  correct_attempts: 0,
  consecutive_correct: 0,
  last_reviewed_at: null,
  last_wrong_at: null,
  mode_stats: {
    flip_en: { attempts: 0, correct: 0 },
    flip_zh: { attempts: 0, correct: 0 },
    spelling: { attempts: 0, correct: 0 },
    fill_blank: { attempts: 0, correct: 0 },
  },
});

// Helper to timeout promises (Crucial for flaky networks)
const callWithTimeout = async (promise, timeoutMs = 5000) => {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Request timed out (Firewall/Network Block?)')),
      timeoutMs
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
};

// --- New SRS Formula Implementation (Pure Function) ---
export const calculateNextReviewStats = (
  currentStats,
  modeKey,
  isCorrect,
  weight
) => {
  // Clone to avoid mutation side-effects if any
  const stats = JSON.parse(JSON.stringify(currentStats || INITIAL_STATS()));

  // Ensure structure
  if (!stats.mode_stats) stats.mode_stats = INITIAL_STATS().mode_stats;

  const INTERVAL_STEPS = [0, 1, 3, 7, 14, 30];
  const now = new Date();

  // Check if Due (or New)
  let isDue = true;
  if (stats.next_review_date) {
    const nextDate = stats.next_review_date.toDate
      ? stats.next_review_date.toDate()
      : new Date(stats.next_review_date);
    if (nextDate > now) {
      isDue = false; // Early Review (Cramming)
    }
  }

  // Only update SRS schedule if it IS due
  if (isDue) {
    if (isCorrect) {
      // PASS Rule
      stats.success_streak = (stats.success_streak || 0) + 1;

      // Find current step and move to next
      let currentStepIndex = INTERVAL_STEPS.indexOf(stats.interval_days || 0);
      if (currentStepIndex === -1) currentStepIndex = 0;

      const nextStepIndex = Math.min(
        currentStepIndex + 1,
        INTERVAL_STEPS.length - 1
      );
      stats.interval_days = INTERVAL_STEPS[nextStepIndex];

      // MASTERED check: streak >= 3 AND interval >= 14
      if (stats.success_streak >= 3 && stats.interval_days >= 14) {
        if (stats.state !== 'MASTERED') {
          stats.mastered_at = serverTimestamp(); // Note: serverTimestamp won't work in pure function for local preview unless handled, but for batch it's fine if we generate it there?
          // Actually, for local preview we can use new Date(), for DB we want serverTimestamp.
          // Let's use new Date() for now, Firestore accepts Date objects.
          stats.mastered_at = new Date();
        }
        stats.state = 'MASTERED';
      } else if (stats.state === 'NEW') {
        stats.state = 'LEARNING';
      }
    } else {
      // FAIL Rule
      if (stats.state === 'MASTERED') {
        // Track demotion
        if (!stats.demotions) stats.demotions = [];
        stats.demotions.push(new Date().toISOString());
        stats.state = 'LEARNING';
      } else if (stats.state === 'NEW') {
        stats.state = 'NEW';
      } else {
        stats.state = 'LEARNING';
      }

      stats.success_streak = 0;
      stats.interval_days = 1;
    }

    // Calculate next review date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + stats.interval_days);
    stats.next_review_date = nextDate;
  }
  // ----------------------------------------

  stats.total_attempts += weight;
  if (stats.mode_stats[modeKey]) {
    stats.mode_stats[modeKey].attempts += 1;
  }
  stats.last_reviewed_at = new Date(); // Use local time for optimstic, batch will convert if needed

  if (isCorrect) {
    stats.correct_attempts += weight;
    stats.consecutive_correct += 1;
    if (stats.mode_stats[modeKey]) stats.mode_stats[modeKey].correct += 1;
  } else {
    stats.consecutive_correct = 0;
    stats.last_wrong_at = new Date();
  }

  return stats;
};

const DataService = {
  // Add a single card
  addCard: async (card) => {
    try {
      const docRef = await callWithTimeout(
        addDoc(collection(db, COLLECTION_NAME), {
          ...card,
          is_starred: card.is_starred || false,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          review_stats: INITIAL_STATS(),
        })
      );
      return docRef.id;
    } catch (error) {
      console.error('Error adding card: ', error);
      throw error;
    }
  },

  // Get all cards (single fetch)
  fetchCards: async () => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('updated_at', 'desc')
      );
      // Using getDocs (One-time fetch), NOT onSnapshot
      const querySnapshot = await callWithTimeout(getDocs(q));

      const cards = [];
      querySnapshot.forEach((doc) => {
        cards.push({ id: doc.id, ...doc.data() });
      });
      return cards;
    } catch (error) {
      console.error('Error fetching cards: ', error);
      throw error;
    }
  },

  // Toggle star status
  toggleStar: async (id, currentStatus) => {
    try {
      const cardRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(cardRef, {
        is_starred: !currentStatus,
        updated_at: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating star: ', error);
      // We don't necessarily throw here for a minor UI toggle, but consistent error handling is good
      throw error;
    }
  },

  // Update card details
  updateCard: async (id, cardData) => {
    try {
      const cardRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(cardRef, {
        word_en: cardData.word_en,
        meaning_zh: cardData.meaning_zh,
        example_en: cardData.example_en,
        is_starred: cardData.is_starred,
        updated_at: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating card: ', error);
      throw error;
    }
  },

  // Delete a card
  deleteCard: async (id) => {
    try {
      await callWithTimeout(deleteDoc(doc(db, COLLECTION_NAME, id)));
    } catch (error) {
      console.error('Error deleting card: ', error);
      throw error;
    }
  },

  // Batch Delete
  batchDeleteCards: async (ids) => {
    let totalCount = 0;
    const CHUNK_SIZE = 450; // Firestore limit is 500

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + CHUNK_SIZE);

      chunk.forEach((id) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        batch.delete(docRef);
        totalCount++;
      });

      if (chunk.length > 0) {
        await callWithTimeout(batch.commit(), 10000);
      }
    }
    return totalCount;
  },

  // Batch Add (for Import)
  batchAddCards: async (cards) => {
    let totalCount = 0;
    const CHUNK_SIZE = 450; // Firestore limit is 500

    for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = cards.slice(i, i + CHUNK_SIZE);

      chunk.forEach((card) => {
        if (!card.word_en || !card.meaning_zh) return;
        const docRef = doc(collection(db, COLLECTION_NAME));
        batch.set(docRef, {
          word_en: String(card.word_en).trim(),
          meaning_zh: String(card.meaning_zh).trim(),
          example_en: Array.isArray(card.example_en)
            ? card.example_en
            : [String(card.example_en || '').trim()].filter(Boolean),
          is_starred: false,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          review_stats: INITIAL_STATS(),
        });
        totalCount++;
      });

      if (chunk.length > 0) {
        await callWithTimeout(batch.commit(), 15000); // 15s for larger batches
      }
    }
    return totalCount;
  },

  // Update statistics after a review (Legacy Single Call - kept for robustness or other uses)
  updateReviewStats: async (cardId, modeKey, isCorrect, weight) => {
    // ... Implement using the helper above would be cleaner but let's just use batch for review
    // For specific single updates (like "I Know" single action outside review?), we might need this.
    try {
      const cardRef = doc(db, COLLECTION_NAME, cardId);
      const snapshot = await getDoc(cardRef);
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      const newStats = calculateNextReviewStats(
        data.review_stats,
        modeKey,
        isCorrect,
        weight
      );

      await updateDoc(cardRef, {
        review_stats: newStats,
        updated_at: serverTimestamp(),
      });
      return newStats;
    } catch (e) {
      console.error(e);
    }
  },

  // Batch Update Stats (New)
  batchUpdateStats: async (cards) => {
    let totalCount = 0;
    const CHUNK_SIZE = 450;

    for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = cards.slice(i, i + CHUNK_SIZE);

      chunk.forEach((card) => {
        const docRef = doc(db, COLLECTION_NAME, card.id);
        // We only update review_stats and updated_at
        batch.update(docRef, {
          review_stats: card.review_stats,
          updated_at: serverTimestamp(),
        });
        totalCount++;
      });

      if (chunk.length > 0) {
        await callWithTimeout(batch.commit(), 20000);
      }
    }
    return totalCount;
  },
};

export default DataService;
