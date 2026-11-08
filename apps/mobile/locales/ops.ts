/**
 * Usage data and crash reports (Profile, Usage data; app/usage-data.tsx). English is the source; ru and es
 * mirror it key for key. Spread into the main dictionaries. What is sent and why: docs/analytics-flags.md.
 */
export const opsEn = {
  "profile.usageData": "Usage data",
  "profile.usageData.anonymous": "Anonymous",
  "profile.usageData.shared": "Shared",
  "profile.usageData.off": "Off",
  "usageData.sheet.a11y": "Usage data",
  "usageData.title": "Usage data",
  "usageData.intro":
    "The app can count what people do in it, such as opening a song or starting the Radio, and report crashes. This helps the team fix what breaks and see what is used. You decide.",
  "usageData.anonymous": "Anonymous",
  "usageData.anonymous.sub": "Counts only. Nothing ties them to you or to your phone.",
  "usageData.shared": "Shared with a random number",
  "usageData.shared.sub": "Counts also carry a random number made on this phone, so the team can see how the app is used over time.",
  "usageData.off": "Off",
  "usageData.off.sub": "Nothing is sent: no counts and no crash reports.",
  "usageData.note.never":
    "Never sent: your name, e-mail, what you search for, what you write, the titles of songs you open, or your listening history.",
  "usageData.note.crash": "A crash report holds the technical error only. Choosing Off stops crash reports too.",
  "usageData.note.change": "You can change this at any time. A new choice applies at once.",
} as const

export const opsEs = {
  "profile.usageData": "Datos de uso",
  "profile.usageData.anonymous": "Anónimo",
  "profile.usageData.shared": "Compartido",
  "profile.usageData.off": "Desactivado",
  "usageData.sheet.a11y": "Datos de uso",
  "usageData.title": "Datos de uso",
  "usageData.intro":
    "La app puede contar lo que se hace en ella, por ejemplo abrir una canción o iniciar la Radio, y enviar informes de fallos. Así el equipo arregla lo que se rompe y ve qué se usa. Tú decides.",
  "usageData.anonymous": "Anónimo",
  "usageData.anonymous.sub": "Solo recuentos. Nada los une a ti ni a tu teléfono.",
  "usageData.shared": "Compartido con un número al azar",
  "usageData.shared.sub":
    "Los recuentos llevan también un número al azar creado en este teléfono, para que el equipo vea cómo se usa la app con el tiempo.",
  "usageData.off": "Desactivado",
  "usageData.off.sub": "No se envía nada: ni recuentos ni informes de fallos.",
  "usageData.note.never":
    "Nunca se envía: tu nombre, correo, lo que buscas, lo que escribes, los títulos de las canciones que abres ni tu historial de escucha.",
  "usageData.note.crash": "Un informe de fallo contiene solo el error técnico. Si eliges Desactivado, tampoco se envían informes de fallos.",
  "usageData.note.change": "Puedes cambiarlo en cualquier momento. La nueva elección se aplica de inmediato.",
} as const

export const opsRu = {
  "profile.usageData": "Данные об использовании",
  "profile.usageData.anonymous": "Анонимно",
  "profile.usageData.shared": "С номером",
  "profile.usageData.off": "Выключено",
  "usageData.sheet.a11y": "Данные об использовании",
  "usageData.title": "Данные об использовании",
  "usageData.intro":
    "Приложение может считать, что люди в нём делают, например открывают песню или включают Радио, и сообщать о сбоях. Так команда чинит то, что ломается, и видит, чем пользуются. Решаете вы.",
  "usageData.anonymous": "Анонимно",
  "usageData.anonymous.sub": "Только счётчики. Ничто не связывает их с вами или вашим телефоном.",
  "usageData.shared": "Со случайным номером",
  "usageData.shared.sub":
    "К счётчикам добавляется случайный номер, созданный на этом телефоне, чтобы команда видела, как приложением пользуются со временем.",
  "usageData.off": "Выключено",
  "usageData.off.sub": "Ничего не отправляется: ни счётчиков, ни отчётов о сбоях.",
  "usageData.note.never":
    "Никогда не отправляются: ваше имя, почта, что вы ищете и пишете, названия открытых песен и история прослушивания.",
  "usageData.note.crash": "Отчёт о сбое содержит только техническую ошибку. Если выбрать «Выключено», отчёты о сбоях тоже не отправляются.",
  "usageData.note.change": "Это можно изменить в любой момент. Новый выбор действует сразу.",
} as const
