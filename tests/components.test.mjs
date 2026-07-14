import assert from "node:assert/strict";
import test from "node:test";

import {
  createVocabularyCard,
  createVocabularyTableRow,
  escapeHtml,
  renderEmptyState,
  renderExampleInput,
  renderImportPreviewItem,
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
  assert.match(mobileCard.innerHTML, /vocab-card-row vocab-card-row-primary/);
  assert.match(mobileCard.innerHTML, /vocab-card-row vocab-card-row-secondary/);
  assert.match(row.innerHTML, /material-symbols-rounded">star</);
  assert.match(mobileCard.innerHTML, /material-symbols-rounded">star</);
  assert.match(row.innerHTML, /aria-label="Remove star from &lt;hej&gt;"/);
  assert.match(
    mobileCard.innerHTML,
    /aria-label="Remove star from &lt;hej&gt;"/,
  );
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

  const section = renderPreviewSection("Notes", ["<note>", "second"]);
  assert.match(section, /class="preview-section"/);
  assert.match(section, /&lt;note&gt;/);
  assert.match(section, /second/);
});

test("renders example input through a shared form component", () => {
  const html = renderExampleInput("Example <placeholder>");

  assert.match(html, /<textarea/);
  assert.match(html, /class="form-field form-field-textarea example-field"/);
  assert.match(html, /class="example-input form-control form-textarea"/);
  assert.match(html, /placeholder="Example &lt;placeholder&gt;"/);
  assert.match(html, /btn-remove-example/);
});

test("renders import preview as word and category only", () => {
  const html = renderImportPreviewItem({
    word: "<Jag>",
    meaning: "我",
    category: "人稱代名詞",
    note: "note",
    examples: ["Jag heter Win."],
  });

  assert.match(html, /class="vocab-card-modern import-preview-card"/);
  assert.match(html, /&lt;Jag&gt;/);
  assert.match(html, /人稱代名詞/);
  assert.doesNotMatch(html, /我/);
  assert.doesNotMatch(html, /note/);
  assert.doesNotMatch(html, /Jag heter Win\./);
  assert.doesNotMatch(html, /vocab-card-meaning|vocab-card-note|vocab-card-examples/);
  assert.doesNotMatch(html, /vocab-card-actions/);
  assert.doesNotMatch(html, /btn-star|btn-edit|btn-delete/);
});
