/**
 * Today's loading and offline states. English is the source; ru and es mirror it key for key.
 * Spread into the main dictionaries.
 */
export const homeStatesEn = {
  "home.loading.a11y": "Loading today's songs",
  "home.offline.title": "Today's songs did not load",
  "home.offline.body": "Check your connection and try again. Songs you downloaded still play.",
} as const

export const homeStatesEs = {
  "home.loading.a11y": "Cargando las canciones de hoy",
  "home.offline.title": "No cargaron las canciones de hoy",
  "home.offline.body": "Revisa tu conexión e inténtalo de nuevo. Las canciones descargadas se siguen oyendo.",
} as const

export const homeStatesRu = {
  "home.loading.a11y": "Загружаются песни на сегодня",
  "home.offline.title": "Песни на сегодня не загрузились",
  "home.offline.body": "Проверьте сеть и попробуйте ещё раз. Скачанные песни по-прежнему играют.",
} as const
