import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isResourceId, resetRateLimits, takeRateLimit } from "./limits.ts";

describe("rate limits", () => {
  it("blocks the call that passes the window", () => {
    resetRateLimits();
    assert.equal(takeRateLimit("upload:user", 2, 10_000, 1_000).ok, true);
    assert.equal(takeRateLimit("upload:user", 2, 10_000, 1_100).ok, true);
    const blocked = takeRateLimit("upload:user", 2, 10_000, 1_200);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.retryAfterSeconds >= 1);
    assert.equal(takeRateLimit("upload:other", 2, 10_000, 1_200).ok, true);
  });
});

describe("resource ids", () => {
  it("accepts a cuid and rejects a path", () => {
    assert.equal(isResourceId("cmvxmk2ta0000fkvstixuqtqa"), true);
    assert.equal(isResourceId("../secret"), false);
    assert.equal(isResourceId(""), false);
    assert.equal(isResourceId("a".repeat(81)), false);
  });
});
