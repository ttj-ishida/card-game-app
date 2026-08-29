const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(monorepoRoot, 'packages')];
config.resolver.extraNodeModules = {
  '@card-game-app/game-core': path.resolve(monorepoRoot, 'packages/game-core'),
  '@card-game-app/ui': path.resolve(monorepoRoot, 'packages/ui'),
};

module.exports = config;
