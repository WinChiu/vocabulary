import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthBypassUser,
  shouldBypassAuthForTesting,
} from "../js/auth-flow.js";

test("does not bypass auth for the old demo flag", () => {
  assert.equal(shouldBypassAuthForTesting("?demo=1"), false);
});

test("bypasses auth only through the testing interface flag", () => {
  assert.equal(shouldBypassAuthForTesting("?auth_bypass=1"), true);
  assert.equal(shouldBypassAuthForTesting("?auth_bypass=true"), true);
  assert.equal(shouldBypassAuthForTesting("?auth_bypass=0"), false);
});

test("creates a testing bypass user without demo identity", () => {
  assert.deepEqual(createAuthBypassUser(), {
    displayName: "Testing Bypass",
    email: "test-bypass@local",
  });
});
