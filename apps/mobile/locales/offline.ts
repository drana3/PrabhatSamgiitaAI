/**
 * Strings of offline saving that go beyond "it failed": why a download stopped (no connection, phone full).
 * English is the source; ru and es mirror it key for key. Spread into the main dictionaries.
 */
export const offlineEn = {
  "dl.toast.offline": "No connection. Saved part is kept, try again when you are online.",
  "dl.toast.noSpace": "Not enough space on this phone. Free some space and try again.",
  "dl.toast.limit": "Your storage limit is full. Free space in Storage or raise the limit, then try again.",
  "storage.toast.over": "Over your {limit} limit. Choose what to delete.",
} as const

export const offlineEs = {
  "dl.toast.offline": "Sin conexión. Lo descargado se conserva; inténtalo de nuevo cuando estés en línea.",
  "dl.toast.noSpace": "No hay espacio suficiente en este teléfono. Libera espacio e inténtalo de nuevo.",
  "dl.toast.limit": "El límite de almacenamiento está lleno. Libera espacio en Almacenamiento o sube el límite e inténtalo de nuevo.",
  "storage.toast.over": "Superas el límite de {limit}. Elige qué borrar.",
} as const

export const offlineRu = {
  "dl.toast.offline": "Нет соединения. Скачанная часть сохранена, попробуйте снова, когда появится сеть.",
  "dl.toast.noSpace": "На телефоне не хватает места. Освободите место и попробуйте снова.",
  "dl.toast.limit": "Лимит хранилища заполнен. Освободите место в разделе «Хранилище» или увеличьте лимит и попробуйте снова.",
  "storage.toast.over": "Превышен лимит {limit}. Выберите, что удалить.",
} as const
