const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")

const config = getDefaultConfig(projectRoot)

// Watch shared package; prefer this app's node_modules over the monorepo root.
config.watchFolders = [
  path.resolve(workspaceRoot, "packages/core"),
  path.resolve(workspaceRoot, "data/generated"),
  path.resolve(workspaceRoot, "data/seed"),
]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
}

module.exports = config
