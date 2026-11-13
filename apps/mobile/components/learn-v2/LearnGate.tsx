import { useRouter } from "expo-router"

import { EmptyCard } from "@/components/learn-v2/LearnBlocks"
import { OverlayScreen } from "@/components/learn-v2/ui"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useT } from "@/lib/i18n"
import { LEARN_ROUTES } from "@/lib/learn/routes"
import { href } from "@/utils/href"

/**
 * What Word cards and the Quiz show while their content is still being checked (lib/learn/verified.ts).
 * One honest page instead of unchecked word meanings or sample questions.
 */
export function LearnGate({ kind }: { kind: "words" | "quiz" }) {
  const t = useT()
  const theme = useAmTheme()
  const router = useRouter()
  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }
  return (
    <OverlayScreen theme={theme} onBack={back} label={kind === "words" ? t("learn.wordCards") : t("learn.quiz")}>
      <EmptyCard
        theme={theme}
        eyebrow={t("learn.gate.eyebrow")}
        title={t(kind === "words" ? "learn.gate.words.title" : "learn.gate.quiz.title")}
        text={t(kind === "words" ? "learn.gate.words.text" : "learn.gate.quiz.text")}
        action={t("learn.gate.back")}
        onAction={back}
      />
    </OverlayScreen>
  )
}
