import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("renders starred filter as a dropdown input", () => {
  const starredFilterMatch = html.match(
    /<select\b(?=[^>]*\bid="filter-starred-only")[^>]*>[\s\S]*?<\/select>/,
  );

  assert.ok(starredFilterMatch, "expected starred filter to be a select");
  assert.match(starredFilterMatch[0], /<option value="all" selected>All<\/option>/);
  assert.match(starredFilterMatch[0], /<option value="starred">Starred<\/option>/);
  assert.doesNotMatch(html, /<md-switch id="filter-starred-only"><\/md-switch>/);
});

test("renders filter dropdowns in a two by two grid", () => {
  assert.match(html, /class="filter-grid-2x2"/);
  assert.match(html, /<span>Type<\/span>[\s\S]*id="filter-type"/);
  assert.match(html, /<span>Star<\/span>[\s\S]*id="filter-starred-only"/);
  assert.match(html, /<span>Status<\/span>[\s\S]*id="filter-status"/);
  assert.match(html, /<span>Category<\/span>[\s\S]*id="filter-category"/);
});
