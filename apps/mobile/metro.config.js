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

// packages/ui/src/index.ts re-exports from './tokens.js', which Metro cannot
// resolve against the TypeScript source. Point the bare package specifier
// straight at the tokens module, which carries every export.
const uiTokensEntry = path.resolve(monorepoRoot, 'packages/ui/src/tokens.ts');

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@card-game-app/ui') {
    return { type: 'sourceFile', filePath: uiTokensEntry };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
