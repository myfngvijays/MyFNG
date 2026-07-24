const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

const config = getDefaultConfig(projectRoot);

// Watch mobile app + repo shared constants/types used via relative imports
config.watchFolders = [projectRoot, sharedRoot];

// Ignore nested node_modules to prevent EMFILE error
config.resolver.blockList = exclusionList([
  /.*\/node_modules\/.*\/node_modules\/.*/,
]);

// Support `@/..` imports (matches tsconfig `paths`)
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@': path.resolve(projectRoot, 'src'),
};

module.exports = config;

