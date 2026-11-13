import { useT } from "@/lib/i18n"

/** `t` for the words of locales/uploadExtras.ts (merged in locales/index.ts, so the typed `t` of en.ts does not list them). */
export type UxTranslate = (key: string, params?: Record<string, string | number>) => string

export function useUx(): UxTranslate {
  return useT() as unknown as UxTranslate
}
