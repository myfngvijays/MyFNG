const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Only watch mobile directory, not parent workspace
config.watchFolders = [projectRoot];

// Ignore nested node_modules to prevent EMFILE error
config.resolver.blockList = exclusionList([
  /.*\/node_modules\/.*\/node_modules\/.*/,
]);

module.exports = config;

