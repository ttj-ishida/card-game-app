import { readFileSync, statSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertSvg(path, size) {
  const svg = readFileSync(path, "utf8");
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";

  assert(
    root.includes('xmlns="http://www.w3.org/2000/svg"'),
    `${path}: missing SVG namespace`,
  );
  assert(root.includes('role="img"'), `${path}: missing image role`);
  assert(svg.includes("<title"), `${path}: missing title`);
  assert(svg.includes("<desc"), `${path}: missing desc`);
  assert(
    root.includes(`width="${size.width}"`),
    `${path}: width must be ${size.width}`,
  );
  assert(
    root.includes(`height="${size.height}"`),
    `${path}: height must be ${size.height}`,
  );
  assert(
    root.includes(`viewBox="${size.viewBox}"`),
    `${path}: viewBox must be ${size.viewBox}`,
  );
  assert(
    statSync(path).size <= size.maxBytes,
    `${path}: exceeds ${size.maxBytes} bytes`,
  );
}

const manifest = readJson("assets/manifests/m4-room-ui-assets.json");

assert(
  JSON.stringify(manifest.todoIds) === JSON.stringify(["M4-GR-01"]),
  "manifest todoIds are incomplete",
);
assert(
  manifest.status === "rough-svg-for-m4-alpha",
  "manifest status is unexpected",
);
assert(manifest.roomLayouts.length === 5, "room layout count must be 5");
assert(manifest.seatBadges.length === 4, "seat badge count must be 4");
assert(
  manifest.readyStateBadges.length === 3,
  "ready state badge count must be 3",
);
assert(
  manifest.connectionBadges.length === 3,
  "connection badge count must be 3",
);

for (let players = 2; players <= 6; players += 1) {
  assert(
    manifest.roomLayouts.some((asset) => asset.playerCount === players),
    `missing ${players}-player room layout`,
  );
}

for (const role of ["HOST", "GUEST", "EMPTY", "CPU_TAKEOVER"]) {
  assert(
    manifest.seatBadges.some((asset) => asset.role === role),
    `missing ${role} seat badge`,
  );
}

for (const state of ["READY", "WAITING", "LOCKED"]) {
  assert(
    manifest.readyStateBadges.some((asset) => asset.readyState === state),
    `missing ${state} ready badge`,
  );
}

for (const state of ["ONLINE", "CONNECTING", "OFFLINE"]) {
  assert(
    manifest.connectionBadges.some((asset) => asset.connectionState === state),
    `missing ${state} connection badge`,
  );
}

const allAssets = [
  ...manifest.roomLayouts,
  ...manifest.seatBadges,
  ...manifest.readyStateBadges,
  ...manifest.connectionBadges,
];
let checked = 0;
const ids = new Set();

for (const asset of allAssets) {
  assert(!ids.has(asset.assetId), `${asset.assetId}: duplicate asset id`);
  ids.add(asset.assetId);
  const size = manifest.sizes[asset.size];
  assert(size, `${asset.assetId}: unknown size ${asset.size}`);
  assert(
    asset.todoId === "M4-GR-01",
    `${asset.assetId}: todoId must be M4-GR-01`,
  );
  assert(
    asset.sourcePath.endsWith(".source.svg"),
    `${asset.assetId}: source path must be editable source SVG`,
  );
  assert(
    asset.runtimePath.endsWith(".svg"),
    `${asset.assetId}: runtime path must be SVG`,
  );
  assertSvg(asset.sourcePath, size);
  assertSvg(asset.runtimePath, size);
  checked += 2;
}

console.log(`M4 room UI assets OK (${checked} SVG files checked)`);
