const productionApi =
  "https://prabhatai-api.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io"

/** @param {{ config: import('expo/config').ExpoConfig }} props */
module.exports = ({ config }) => {
  const configuredProjectId =
    process.env.EAS_PROJECT_ID?.trim() || config.extra?.eas?.projectId

  return {
    ...config,
    ios: {
      ...config.ios,
      buildNumber: config.ios?.buildNumber ?? "1",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        ...(config.ios?.infoPlist ?? {}),
      },
    },
    android: {
      ...config.android,
      versionCode: config.android?.versionCode ?? 1,
    },
    extra: {
      ...config.extra,
      apiBaseUrl:
        process.env.EXPO_PUBLIC_API_BASE_URL ?? config.extra?.apiBaseUrl ?? productionApi,
      webBaseUrl:
        process.env.EXPO_PUBLIC_WEB_BASE_URL ??
        config.extra?.webBaseUrl ??
        "https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io",
      memberProxyKey: process.env.EXPO_PUBLIC_MEMBER_PROXY_KEY ?? config.extra?.memberProxyKey,
      azureClientId: process.env.EXPO_PUBLIC_AZURE_CLIENT_ID ?? config.extra?.azureClientId,
      azureTenantId:
        process.env.EXPO_PUBLIC_AZURE_TENANT_ID ?? config.extra?.azureTenantId ?? "common",
      ...(configuredProjectId ? { eas: { projectId: configuredProjectId } } : {}),
    },
  }
}
