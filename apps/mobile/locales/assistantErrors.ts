/**
 * What the assistant says when a question cannot be answered, by reason (see lib/assistantTurn.ts).
 * The server sends a stable `X-Error-Code`; the words live here so they follow the app language.
 * English is the source; ru and es mirror it key for key. Spread into the main dictionaries.
 */
export const assistantErrorsEn = {
  "assistant.error.timeout": "That took too long. Please try again.",
  "assistant.error.offline": "You appear to be offline. Please try again when you are connected.",
  "assistant.error.rateLimited": "Too many questions at once. Wait a minute, then try again.",
  "assistant.error.signedOut": "Your sign-in is no longer valid. Sign in again to keep asking.",
  "assistant.error.unavailable": "The assistant is temporarily unavailable. Please try again.",
  "assistant.error.quotaGuest": "You have used today's guest questions. Sign in for more, or come back tomorrow.",
  "assistant.error.quotaMember": "You have used today's questions. Come back tomorrow, or keep exploring lyrics, meanings and recordings.",
} as const

export const assistantErrorsEs = {
  "assistant.error.timeout": "Tardó demasiado. Inténtalo de nuevo.",
  "assistant.error.offline": "Parece que no tienes conexión. Inténtalo de nuevo cuando la tengas.",
  "assistant.error.rateLimited": "Demasiadas preguntas seguidas. Espera un minuto e inténtalo de nuevo.",
  "assistant.error.signedOut": "Tu inicio de sesión ya no es válido. Inicia sesión de nuevo para seguir preguntando.",
  "assistant.error.unavailable": "El asistente no está disponible por ahora. Inténtalo de nuevo.",
  "assistant.error.quotaGuest": "Has usado las preguntas de invitado de hoy. Inicia sesión para tener más, o vuelve mañana.",
  "assistant.error.quotaMember": "Has usado las preguntas de hoy. Vuelve mañana, o sigue explorando letras, significados y grabaciones.",
} as const

export const assistantErrorsRu = {
  "assistant.error.timeout": "Это заняло слишком много времени. Попробуйте ещё раз.",
  "assistant.error.offline": "Похоже, нет сети. Попробуйте ещё раз, когда подключитесь.",
  "assistant.error.rateLimited": "Слишком много вопросов подряд. Подождите минуту и попробуйте снова.",
  "assistant.error.signedOut": "Ваш вход больше не действует. Войдите снова, чтобы продолжить.",
  "assistant.error.unavailable": "Помощник сейчас недоступен. Попробуйте ещё раз.",
  "assistant.error.quotaGuest": "Вопросы гостя на сегодня закончились. Войдите, чтобы задать больше, или вернитесь завтра.",
  "assistant.error.quotaMember": "Вопросы на сегодня закончились. Возвращайтесь завтра или продолжайте знакомиться со словами, смыслами и записями.",
} as const
