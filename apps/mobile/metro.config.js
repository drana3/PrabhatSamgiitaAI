const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")

const config = getDefaultConfig(projectRoot)

// This app installs its own dependencies, so only the shared package needs
// watching outside the project.
config.watchFolders = [path.resolve(workspaceRoot, "packages/core")]
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")]

module.exports = config
