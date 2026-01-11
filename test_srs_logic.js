// Mocking logic from data.js
const INITIAL_STATS = () => ({
  state: 'NEW',
  success_streak: 0,
  interval_days: 0,
  next_review_date: null,
  mastered_at: null,
  demotions: [],
  total_attempts: 0,
  correct_attempts: 0,
  consecutive_correct: 0,
  last_reviewed_at: null,
  last_wrong_at: null,
  mode_stats: {
    flip_en: { attempts: 0, correct: 0 },
  },
});

const calculateNextReviewStats = (currentStats, modeKey, isCorrect, weight) => {
  const stats = JSON.parse(JSON.stringify(currentStats || INITIAL_STATS()));

  if (!stats.mode_stats) stats.mode_stats = INITIAL_STATS().mode_stats;

  const INTERVAL_STEPS = [0, 1, 3, 7, 14, 30];
  const now = new Date(); // Test uses system time

  // Check if Due (or New)
  let isDue = true;
  if (stats.next_review_date) {
    // Mock toDate handling
    const nextDate = stats.next_review_date.toDate
      ? stats.next_review_date.toDate() // Not used here as we pass Dates
      : new Date(stats.next_review_date);
    if (nextDate > now) {
      isDue = false; // Early Review (Cramming)
    }
  }

  // LOGIC UNDER TEST
  if (isDue) {
    if (isCorrect) {
      stats.success_streak = (stats.success_streak || 0) + 1;
      let currentStepIndex = INTERVAL_STEPS.indexOf(stats.interval_days || 0);
      if (currentStepIndex === -1) currentStepIndex = 0;
      const nextStepIndex = Math.min(
        currentStepIndex + 1,
        INTERVAL_STEPS.length - 1
      );
      stats.interval_days = INTERVAL_STEPS[nextStepIndex];

      if (stats.success_streak >= 3 && stats.interval_days >= 14) {
        if (stats.state !== 'MASTERED') {
          stats.mastered_at = new Date();
        }
        stats.state = 'MASTERED';
      } else if (!stats.state || stats.state === 'NEW') {
        stats.state = 'LEARNING';
      }
    } else {
      // Fail logic... ignored for now
    }

    // Update next date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + stats.interval_days);
    nextDate.setHours(0, 0, 0, 0);
    stats.next_review_date = nextDate;
  }

  // Always update usage stats
  // ...

  return { stats, isDue }; // Return isDue for verification
};

// --- RUN TESTS ---

// 1. Test Future Date (Should NOT be Due)
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(0, 0, 0, 0);

const futureStats = INITIAL_STATS();
futureStats.state = 'LEARNING';
futureStats.interval_days = 1;
futureStats.next_review_date = tomorrow; // Due tomorrow

console.log('Test 1: Future Date');
const res1 = calculateNextReviewStats(futureStats, 'flip_en', true, 1);
console.log('Is Due:', res1.isDue); // Should be false
console.log('Interval changed:', res1.stats.interval_days !== 1); // Should be false
console.log('State:', res1.stats.state);

// 2. Test Today Date (Should be Due)
const today = new Date();
today.setHours(0, 0, 0, 0); // Today midnight

const dueStats = INITIAL_STATS();
dueStats.state = 'LEARNING';
dueStats.interval_days = 1;
dueStats.next_review_date = today; // Due today

console.log('Test 2: Due Date');
const res2 = calculateNextReviewStats(dueStats, 'flip_en', true, 1);
console.log('Is Due:', res2.isDue); // Should be true
console.log('Interval changed:', res2.stats.interval_days !== 1); // Should be true (1->3)

// 3. Test New Card (Should be Due)
const newStats = INITIAL_STATS();
console.log('Test 3: New Card');
const res3 = calculateNextReviewStats(newStats, 'flip_en', true, 1);
console.log('Is Due:', res3.isDue); // Should be true
console.log('State:', res3.stats.state); // Should be LEARNING
