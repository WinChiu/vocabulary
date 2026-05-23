import assert from "node:assert/strict";
import test from "node:test";

import {
  createVocabularyCard,
  createVocabularyTableRow,
  escapeHtml,
  renderEmptyState,
  renderExampleInput,
  renderPreviewSection,
  renderVocabularyTableShell,
} from "../js/components.js";

const level = { class: "level-learning", label: "Learning" };

test("escapes html in shared component output", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')">`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;",
  );
});

test("renders shared vocabulary table shell", () => {
  const html = renderVocabularyTableShell();

  assert.match(html, /id="vocab-table-body"/);
  assert.match(html, /class="vocab-list-modern"/);
});

test("renders vocabulary row and card from the same status and action components", () => {
  const card = {
    id: "word-1",
    word_en: "<hej>",
    meaning_zh: "你好",
    is_starred: true,
  };

  const row = createVocabularyTableRow(card, level);
  const mobileCard = createVocabularyCard(card, level);

  assert.equal(row.dataset.id, "word-1");
  assert.equal(mobileCard.dataset.id, "word-1");
  assert.match(row.innerHTML, /assets\/star-filled\.svg/);
  assert.match(mobileCard.innerHTML, /assets\/star-filled\.svg/);
  assert.match(row.innerHTML, /&lt;hej&gt;/);
  assert.match(mobileCard.innerHTML, /&lt;hej&gt;/);
  assert.match(row.innerHTML, /level-learning/);
  assert.match(mobileCard.innerHTML, /level-learning/);
});

test("renders reusable preview and empty state sections", () => {
  assert.equal(
    renderEmptyState("No vocabulary found."),
    '<div class="empty-state">No vocabulary found.</div>',
  );

  const section = renderPreviewSection("筆記", ["<note>", "second"]);
  assert.match(section, /class="preview-section"/);
  assert.match(section, /&lt;note&gt;/);
  assert.match(section, /second/);
});

test("renders example input through a shared form component", () => {
  const html = renderExampleInput("例句 <placeholder>");

  assert.match(html, /<textarea/);
  assert.match(html, /class="form-field form-field-textarea example-field"/);
  assert.match(html, /class="example-input form-control form-textarea"/);
  assert.match(html, /placeholder="例句 &lt;placeholder&gt;"/);
  assert.match(html, /btn-remove-example/);
});
