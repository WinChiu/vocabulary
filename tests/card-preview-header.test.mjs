import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("places preview status badge immediately before the sound action", () => {
  const actionsMatch = html.match(
    /<div class="preview-top-actions">[\s\S]*?<\/div>/,
  );

  assert.ok(actionsMatch, "expected preview top actions");
  assert.match(
    actionsMatch[0],
    /id="preview-status-badge"[\s\S]*id="preview-audio-btn"/,
  );
  assert.doesNotMatch(html, /<div class="preview-header-status">/);
});
