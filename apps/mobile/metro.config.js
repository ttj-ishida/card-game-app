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

// packages/game-core/src/index.ts re-exports from sibling './*.js' modules
// (NodeNext style). Metro cannot resolve those explicit '.js' specifiers
// against the TypeScript source, so retry them with the extension stripped.
const gameCoreSrc = path.resolve(monorepoRoot, 'packages/game-core/src');

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@card-game-app/ui') {
    return { type: 'sourceFile', filePath: uiTokensEntry };
  }
  if (
    moduleName.startsWith('./') &&
    moduleName.endsWith('.js') &&
    typeof context.originModulePath === 'string' &&
    context.originModulePath.startsWith(gameCoreSrc)
  ) {
    return context.resolveRequest(context, moduleName.slice(0, -'.js'.length), platform);
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
