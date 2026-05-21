import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategoryOptions,
  categoryMatchesFilter,
  normalizeCategory,
} from "../js/category.js";

test("normalizes category text", () => {
  assert.equal(normalizeCategory("  數字  "), "數字");
  assert.equal(normalizeCategory(null), "");
  assert.equal(normalizeCategory(undefined), "");
});

test("builds sorted unique category options from cards", () => {
  const cards = [
    { category: "數字" },
    { category: " 所有格 " },
    { category: "數字" },
    { category: "" },
    {},
  ];

  assert.deepEqual(buildCategoryOptions(cards), ["所有格", "數字"]);
});

test("matches all, specific, and uncategorized category filters", () => {
  assert.equal(categoryMatchesFilter({ category: "傢俱" }, "all"), true);
  assert.equal(categoryMatchesFilter({ category: "傢俱" }, "傢俱"), true);
  assert.equal(categoryMatchesFilter({ category: "數字" }, "傢俱"), false);
  assert.equal(
    categoryMatchesFilter({ category: "" }, "__uncategorized"),
    true,
  );
  assert.equal(categoryMatchesFilter({}, "__uncategorized"), true);
  assert.equal(
    categoryMatchesFilter({ category: "傢俱" }, "__uncategorized"),
    false,
  );
});
