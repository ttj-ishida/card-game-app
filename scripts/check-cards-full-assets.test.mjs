import assert from "node:assert/strict";
import { test } from "node:test";

import { jpegSize, pngSize } from "./check-cards-full-assets.mjs";

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

/** A minimal but structurally real JPEG: SOI, APP0/JFIF, SOF0, EOI. */
function fakeJpegBuffer(width, height) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const sof0 = Buffer.alloc(2 + 2 + 1 + 2 + 2 + 1 + 3);
  sof0.writeUInt8(0xff, 0);
  sof0.writeUInt8(0xc0, 1);
  sof0.writeUInt16BE(17, 2); // segment length (excludes the FFC0 marker bytes)
  sof0.writeUInt8(8, 4); // precision
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0.writeUInt8(1, 9); // 1 component
  sof0.writeUInt8(1, 10);
  sof0.writeUInt8(0x11, 11);
  sof0.writeUInt8(0, 12);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app0, sof0, eoi]);
}

test("jpegSize reads width/height from a JPEG SOF0 segment", () => {
  assert.deepEqual(jpegSize(fakeJpegBuffer(832, 1164)), {
    width: 832,
    height: 1164,
  });
});

test("jpegSize returns null for a non-JPEG buffer", () => {
  assert.equal(jpegSize(Buffer.from("not a jpeg at all......")), null);
});

test("jpegSize returns null for a too-short buffer", () => {
  assert.equal(jpegSize(Buffer.alloc(2)), null);
});
