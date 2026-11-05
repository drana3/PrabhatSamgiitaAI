/**
 * Interface strings of the app shell and the honest states that replaced the placeholder content:
 * not-found, "could not load, try again", the festival calendar, the Learn gates. English is the source
 * of truth; ru and es mirror it key for key (the parity test checks them once these objects are spread into
 * locales/en.ts, ru.ts and es.ts). "Kiirtan" is always written with two i's.
 */
export const appShellEn = {
  "notFound.title": "Page not found",
  "notFound.body": "This link is not part of the app. Head home to continue.",
  "notFound.home": "Go home",
  "notice.retry": "Try again",
  "notice.goBack": "Go back",
} as const

export const appShellRu: Record<keyof typeof appShellEn, string> = {
  "notFound.title": "Страница не найдена",
  "notFound.body": "Этой ссылки нет в приложении. Вернитесь на главную.",
  "notFound.home": "На главную",
  "notice.retry": "Попробовать снова",
  "notice.goBack": "Назад",
}

export const appShellEs: Record<keyof typeof appShellEn, string> = {
  "notFound.title": "Página no encontrada",
  "notFound.body": "Este enlace no es parte de la app. Vuelve al inicio para continuar.",
  "notFound.home": "Ir al inicio",
  "notice.retry": "Intentar de nuevo",
  "notice.goBack": "Volver",
}
