import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sortVocabularyCards } from "../js/sort.js";

const cards = [
  {
    id: "2",
    word_en: "banana",
    created_at: "2026-05-02T00:00:00.000Z",
    review_stats: { state: "LEARNING" },
  },
  {
    id: "1",
    word_en: "Apple",
    created_at: "2026-05-03T00:00:00.000Z",
    review_stats: { state: "MASTERED" },
  },
  {
    id: "3",
    word_en: "cherry",
    created_at: "2026-05-01T00:00:00.000Z",
    review_stats: { state: "NEW" },
  },
];

test("sorts vocabulary cards by newest first by default", () => {
  assert.deepEqual(
    sortVocabularyCards(cards).map((card) => card.word_en),
    ["Apple", "banana", "cherry"],
  );
});

test("sorts vocabulary cards alphabetically in both directions", () => {
  assert.deepEqual(
    sortVocabularyCards(cards, "az").map((card) => card.word_en),
    ["Apple", "banana", "cherry"],
  );
  assert.deepEqual(
    sortVocabularyCards(cards, "za").map((card) => card.word_en),
    ["cherry", "banana", "Apple"],
  );
});

test("sorts vocabulary cards by learning status", () => {
  assert.deepEqual(
    sortVocabularyCards(cards, "status").map((card) => card.review_stats.state),
    ["NEW", "LEARNING", "MASTERED"],
  );
});

test("renders vocabulary sort as a header button with a popup", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const sortPopupMatch = html.match(
    /<div\b(?=[^>]*\bclass="[^"]*\bsort-sheet-label\b)[^>]*>[\s\S]*?<\/div>\s*<\/div>/,
  );

  assert.match(html, /id="vocab-sort-btn"[\s\S]*aria-label="Sort vocabulary"/);
  assert.ok(sortPopupMatch, "expected vocabulary sort popup");
  assert.match(sortPopupMatch[0], /data-sort-order="newest"[\s\S]*New - Old/);
  assert.match(sortPopupMatch[0], /data-sort-order="az"[\s\S]*A-Z/);
  assert.match(sortPopupMatch[0], /data-sort-order="za"[\s\S]*Z-A/);
  assert.match(sortPopupMatch[0], /data-sort-order="status"[\s\S]*Status/);
});
