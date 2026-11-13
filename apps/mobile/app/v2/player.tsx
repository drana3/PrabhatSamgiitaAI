import { Redirect } from "expo-router"

import { NAV_V2_PLAYER_ROUTE } from "@/lib/navV2"
import { href } from "@/utils/href"

/** Old link /v2/player. The Player is not a tab any more: it is the full player behind the mini-player pill. */
export default function V2PlayerRedirect() {
  return <Redirect href={href(NAV_V2_PLAYER_ROUTE)} />
}
