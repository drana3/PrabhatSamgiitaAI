import { Platform } from "react-native"

import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { createPushController, type PushController } from "@/lib/push/registration"
import { readExpoPushToken } from "@/lib/push/token"

export { pushSupported } from "@/lib/push/config"

let controller: PushController | null = null

/** The one controller of this app run, wired to the real server and the OS. */
export function pushController(): PushController {
  if (!controller) {
    controller = createPushController({
      config: remoteConfig,
      getToken: async () => (canUseServer() ? readExpoPushToken() : null),
    })
  }
  return controller
}

export const pushPlatform = (): "ios" | "android" => (Platform.OS === "ios" ? "ios" : "android")
