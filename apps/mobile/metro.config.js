const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]
// The web app pins react 19 while this app is on the react 18 / RN 0.76 stack,
// so npm keeps a second react-native at the workspace root. Resolving only
// through nodeModulesPaths keeps every module on the app's own copy.
config.resolver.disableHierarchicalLookup = true
// Watchman indexes the whole monorepo and stalls in sandboxed CI containers.
config.resolver.useWatchman = false

module.exports = config
