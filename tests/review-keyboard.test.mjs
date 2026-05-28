import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("review view uses a locked viewport height to avoid keyboard resize shifts", () => {
  const css = readSource("../scss/style.scss");
  const utils = readSource("../js/utils.js");
  const review = readSource("../js/review.js");
  const reviewSessionBlock = css.match(/#review-session \{[\s\S]*?\n\}/)?.[0] || "";
  const flashcardBlock = css.match(/\.flashcard \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(utils, /classList\.toggle\(\s*'review-session-active'/);
  assert.match(review, /spellingInput\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(review, /clozeInput\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(css, /--review-viewport-height/);
  assert.match(
    reviewSessionBlock,
    /#review-session[\s\S]*height:\s*calc\(var\(--review-viewport-height\)/,
  );
  assert.match(
    flashcardBlock,
    /\.flashcard[\s\S]*min-height:\s*calc\(var\(--review-viewport-height\)/,
  );
  assert.doesNotMatch(reviewSessionBlock, /min-height:\s*calc\(100dvh/);
  assert.doesNotMatch(flashcardBlock, /min-height:\s*calc\(100dvh/);
});
