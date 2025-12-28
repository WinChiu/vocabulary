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
    const batch = writeBatch(db);
    let count = 0;

    // Firestore limit is 500 per batch
    const CHUNK_SIZE = 450;
    const toDelete = ids.slice(0, CHUNK_SIZE);

    toDelete.forEach((id) => {
      const docRef = doc(db, COLLECTION_NAME, id);
      batch.delete(docRef);
      count++;
    });

    if (count > 0) {
      await callWithTimeout(batch.commit(), 10000);
    }
    return count;
  },

  // Batch Add (for Import)
  batchAddCards: async (cards) => {
    const batch = writeBatch(db);
    let count = 0;
    const CHUNK_SIZE = 400;
    const chunk = cards.slice(0, CHUNK_SIZE);

    chunk.forEach((card) => {
      if (!card.word_en || !card.meaning_zh) return;
      const docRef = doc(collection(db, COLLECTION_NAME));
      batch.set(docRef, {
        word_en: String(card.word_en).trim(),
        meaning_zh: String(card.meaning_zh).trim(),
        example_en: String(card.example_en || '').trim(),
        is_starred: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        review_stats: INITIAL_STATS(),
      });
      count++;
    });

    if (count > 0) {
      await callWithTimeout(batch.commit(), 10000); // 10s for batch
    }
    return count;
  },

  // Update statistics after a review
  updateReviewStats: async (cardId, modeKey, isCorrect, weight) => {
    try {
      const cardRef = doc(db, COLLECTION_NAME, cardId);

      const snapshot = await getDoc(cardRef);
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      const stats = data.review_stats || INITIAL_STATS();

      // --- New SRS Formula Implementation ---
      const INTERVAL_STEPS = [0, 1, 3, 7, 14, 30];

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
            stats.mastered_at = serverTimestamp();
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
        }
        stats.state = 'LEARNING';
        stats.success_streak = 0;
        stats.interval_days = 1;
      }

      // Calculate next review date
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + stats.interval_days);
      stats.next_review_date = nextDate;
      // ----------------------------------------

      stats.total_attempts += weight;
      stats.mode_stats[modeKey].attempts += 1;
      stats.last_reviewed_at = serverTimestamp();

      if (isCorrect) {
        stats.correct_attempts += weight;
        stats.consecutive_correct += 1;
        stats.mode_stats[modeKey].correct += 1;
      } else {
        stats.consecutive_correct = 0;
        stats.last_wrong_at = serverTimestamp();
      }

      await updateDoc(cardRef, {
        review_stats: stats,
        updated_at: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating review stats:', error);
    }
  },
};

export default DataService;
