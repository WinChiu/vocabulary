import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getLanguageConfig } from "../js/language.js";
import { renderVocabularyTableShell } from "../js/components.js";

const uiCopyHasCjk = (value) => /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u.test(value);

test("language search placeholders are English-only", () => {
  assert.equal(
    getLanguageConfig("en").searchPlaceholder,
    "Search words or meanings...",
  );
  assert.equal(
    getLanguageConfig("sv").searchPlaceholder,
    "Search words or meanings...",
  );
});

test("vocabulary table headers are English-only", () => {
  const html = renderVocabularyTableShell();

  assert.match(html, /<th>Word<\/th>/);
  assert.match(html, /<th>Status<\/th>/);
  assert.equal(uiCopyHasCjk(html), false);
});

test("review UI copy is English-only", async () => {
  const source = await readFile(new URL("../js/review.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\u9ede\u64ca\u7ffb\u9762|\u9700\u8981\u518d\u8907\u7fd2/);
  assert.match(source, /Click to flip/);
  assert.match(source, /Worth another look/);
});
