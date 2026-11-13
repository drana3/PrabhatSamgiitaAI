/**
 * Words for the Terms link on the About screen and the age confirmation at sign-up (minimum age 16,
 * docs/age-confirmation.md). English is the source; ru and es mirror it key for key and are unreviewed
 * (locales/review.json). "Terms" and "Privacy Policy" link labels are the existing account.legal.* keys.
 */
export const legalEn = {
  "about.legal.title": "Legal",
  "account.age.confirm": "I'm 16 or older",
  "account.age.required": "Tick the box to confirm you are 16 or older.",
  "account.age.line": "By continuing you confirm you are 16 or older.",
} as const
export const legalEs = {
  "about.legal.title": "Información legal",
  "account.age.confirm": "Tengo 16 años o más",
  "account.age.required": "Marca la casilla para confirmar que tienes 16 años o más.",
  "account.age.line": "Al continuar, confirmas que tienes 16 años o más.",
} as const
export const legalRu = {
  "about.legal.title": "Правовая информация",
  "account.age.confirm": "Мне 16 лет или больше",
  "account.age.required": "Отметьте, что вам 16 лет или больше.",
  "account.age.line": "Продолжая, вы подтверждаете, что вам 16 лет или больше.",
} as const
