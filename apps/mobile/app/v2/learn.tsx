import { TabPlaceholder } from "@/components/nav-v2/TabPlaceholder"

/** Placeholder until the learn branch adds the redesigned Learn screen. */
export default function LearnTab() {
  return (
    <TabPlaceholder
      title="Learn"
      note="Stories, quiz, harmonium and notation. The redesigned Learn screen is built on its own branch."
      legacyHref="/stories"
    />
  )
}
