const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const fs = require('fs');

let standaloneAssetRegistry;
try {
  standaloneAssetRegistry = require.resolve('@react-native/assets-registry/registry.js', {
    paths: [projectRoot, monorepoRoot],
  });
} catch {
  standaloneAssetRegistry = path.resolve(
    monorepoRoot,
    'node_modules/.pnpm/@react-native+assets-registry@0.74.87/node_modules/@react-native/assets-registry/registry.js'
  );
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@react-native/assets-registry') && standaloneAssetRegistry && fs.existsSync(standaloneAssetRegistry)) {
    return {
      filePath: standaloneAssetRegistry,
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

