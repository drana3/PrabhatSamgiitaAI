import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** A dictionary is a flat map. Plural groups use the suffixes `_one`, `_few`, `_many`, `_other`. */
export type Dictionary = Readonly<Record<string, string>>

export const dictionaries = { en, ru, es } as const satisfies Record<"en" | "ru" | "es", Dictionary>
