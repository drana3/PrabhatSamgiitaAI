/**
 * Strings of offline saving that go beyond "it failed": why a download stopped (no connection, phone full).
 * English is the source; ru and es mirror it key for key. Spread into the main dictionaries.
 */
export const offlineEn = {
  "dl.toast.offline": "No connection. Saved part is kept, try again when you are online.",
  "dl.toast.noSpace": "Not enough space on this phone. Free some space and try again.",
} as const

export const offlineEs = {
  "dl.toast.offline": "Sin conexión. Lo descargado se conserva; inténtalo de nuevo cuando estés en línea.",
  "dl.toast.noSpace": "No hay espacio suficiente en este teléfono. Libera espacio e inténtalo de nuevo.",
} as const

export const offlineRu = {
  "dl.toast.offline": "Нет соединения. Скачанная часть сохранена, попробуйте снова, когда появится сеть.",
  "dl.toast.noSpace": "На телефоне не хватает места. Освободите место и попробуйте снова.",
} as const
