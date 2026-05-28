import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("renders review setup filters as a two by two grid", () => {
  const reviewGridMatch = html.match(
    /<div class="review-grid-2x2">[\s\S]*?<\/div>\s*<div class="input-wrapper-flex review-limit-row">/,
  );

  assert.ok(reviewGridMatch, "expected review setup filter grid before limit row");
  assert.match(reviewGridMatch[0], /for="review-setup-type"[\s\S]*Type/);
  assert.match(reviewGridMatch[0], /for="review-scope"[\s\S]*Star/);
  assert.match(reviewGridMatch[0], /for="review-status"[\s\S]*Status/);
  assert.match(reviewGridMatch[0], /for="review-category"[\s\S]*Category/);
  assert.match(html, /class="input-wrapper-flex review-limit-row"[\s\S]*for="review-limit"/);
});
