// Preloaded via `node --require` for `npm test`. Metro's bundler transforms
// `require('*.png'|'*.jpg')` into a numeric asset id; plain Node has no such
// transform and would otherwise try to parse the binary file as JS. This
// stubs those extensions to a placeholder number so tests that exercise real
// asset require() thunks (e.g. cardArtAssets.generated.ts once art lands)
// don't crash under `node --test`.
const Module = require('module');
for (const ext of ['.png', '.jpg', '.jpeg']) {
  Module._extensions[ext] = (mod) => {
    mod.exports = 0;
  };
}
