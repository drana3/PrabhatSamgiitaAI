/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json")

const base = appJson.expo
const configuredProjectId =
  process.env.EAS_PROJECT_ID?.trim() || base.extra?.eas?.projectId

const productionApi =
  "https://prabhatai-api.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io"

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...base,
  ios: {
    ...base.ios,
    buildNumber: base.ios?.buildNumber ?? "1",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(base.ios?.infoPlist ?? {}),
    },
  },
  android: {
    ...base.android,
    versionCode: base.android?.versionCode ?? 1,
  },
  extra: {
    ...base.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? base.extra?.apiBaseUrl ?? productionApi,
    ...(configuredProjectId ? { eas: { projectId: configuredProjectId } } : {}),
  },
}

module.exports = config
