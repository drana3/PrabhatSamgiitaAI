const productionApi =
  "https://prabhatai-api.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io"

const APP_PACKAGE = "net.prabhatasamgiita.ai"

function googleReversedScheme(clientId) {
  const trimmed = (clientId || "").trim()
  if (!trimmed.endsWith(".apps.googleusercontent.com")) return null
  const prefix = trimmed.replace(/\.apps\.googleusercontent\.com$/, "")
  return `com.googleusercontent.apps.${prefix}`
}

function mergeUrlSchemes(existing, schemes) {
  const next = [...(existing ?? [])]
  for (const scheme of schemes) {
    if (!scheme) continue
    const already = next.some((entry) =>
      Array.isArray(entry?.CFBundleURLSchemes)
        ? entry.CFBundleURLSchemes.includes(scheme)
        : false,
    )
    if (!already) next.push({ CFBundleURLSchemes: [scheme] })
  }
  return next
}

/** @param {{ config: import('expo/config').ExpoConfig }} props */
module.exports = ({ config }) => {
  const configuredProjectId =
    process.env.EAS_PROJECT_ID?.trim() || config.extra?.eas?.projectId

  const iosGoogleScheme = googleReversedScheme(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID)
  const androidGoogleScheme = googleReversedScheme(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)

  return {
    ...config,
    ios: {
      ...config.ios,
      buildNumber: config.ios?.buildNumber ?? "1",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        ...(config.ios?.infoPlist ?? {}),
        CFBundleURLTypes: mergeUrlSchemes(config.ios?.infoPlist?.CFBundleURLTypes, [
          "prabhatai",
          APP_PACKAGE,
          iosGoogleScheme,
        ]),
      },
    },
    android: {
      ...config.android,
      versionCode: config.android?.versionCode ?? 1,
      intentFilters: [
        ...(config.android?.intentFilters ?? []),
        {
          action: "VIEW",
          autoVerify: false,
          category: ["BROWSABLE", "DEFAULT"],
          data: [{ scheme: APP_PACKAGE, pathPrefix: "/oauthredirect" }],
        },
        ...(androidGoogleScheme
          ? [
              {
                action: "VIEW",
                autoVerify: false,
                category: ["BROWSABLE", "DEFAULT"],
                data: [{ scheme: androidGoogleScheme, pathPrefix: "/oauthredirect" }],
              },
            ]
          : []),
      ],
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
      googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? config.extra?.googleClientId,
      googleIosClientId:
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? config.extra?.googleIosClientId,
      googleAndroidClientId:
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? config.extra?.googleAndroidClientId,
      ...(configuredProjectId ? { eas: { projectId: configuredProjectId } } : {}),
    },
  }
}
