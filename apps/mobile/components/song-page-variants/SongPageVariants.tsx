import { useLocalSearchParams, useRouter } from "expo-router"

import { useSpTheme } from "@/hooks/useSpTheme"
import { routeString } from "@/lib/songMap"
import type { SongPageVariant } from "@/lib/songPageVariants/variant"

import { ShellMessage } from "./Shell"
import { VariantSwitcher } from "./Switcher"
import { useSongVariantModel } from "./useSongVariantModel"
import { VariantA } from "./VariantA"
import { VariantB } from "./VariantB"
import { VariantC } from "./VariantC"

/** The song page in variant A, B or C, built from the real data hooks. ("current" is the old page, rendered by the route.) */
export function SongPageVariants({ variant, onPick }: { variant: Exclude<SongPageVariant, "current">; onPick: (next: SongPageVariant) => void }) {
  const params = useLocalSearchParams<{ songId: string | string[] }>()
  const songId = routeString(params.songId)
  const router = useRouter()
  const t = useSpTheme()
  const model = useSongVariantModel(songId)
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"))
  if (!model.song) return <ShellMessage t={t} loading={model.loading} onBack={back} />
  return (
    <>
      {variant === "a" ? <VariantA t={t} model={model} /> : variant === "c" ? <VariantC t={t} model={model} /> : <VariantB t={t} model={model} />}
      <VariantSwitcher variant={variant} onPick={onPick} />
    </>
  )
}
