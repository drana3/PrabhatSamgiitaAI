// babel-preset-expo only enables the expo-router plugin when it can resolve
// expo-router relative to itself. The preset hoists to the workspace root while
// the mobile dependency tree stays nested (react 18 here, react 19 on web), so
// that lookup fails and `process.env.EXPO_ROUTER_APP_ROOT` is never inlined.
const { expoRouterBabelPlugin } = require("babel-preset-expo/build/expo-router-plugin")

module.exports = function (api) {
  api.cache(true)
  return {
    presets: ["babel-preset-expo"],
    plugins: [expoRouterBabelPlugin],
  }
}
