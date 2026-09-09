import assert from "node:assert/strict";
import { test } from "node:test";

import { pngSize } from "./check-cards-full-assets.mjs";

function fakePngHeader(width, height) {
  const b = Buffer.alloc(24);
  b.write("\x89PNG\r\n\x1a\n", 0, "binary");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

test("pngSize reads width/height from a PNG IHDR header", () => {
  assert.deepEqual(pngSize(fakePngHeader(832, 1164)), {
    width: 832,
    height: 1164,
  });
});

test("pngSize returns null for a non-PNG buffer", () => {
  assert.equal(pngSize(Buffer.from("not a png at all........")), null);
});

test("pngSize returns null for a too-short buffer", () => {
  assert.equal(pngSize(Buffer.alloc(10)), null);
});
