/**
 * Volume leveling (profile settings, app/volume-leveling.tsx). English is the source; ru and es mirror it
 * key for key. Spread into the main dictionaries. How it works: docs/loudness-leveling.md.
 */
export const volumeEn = {
  "profile.volumeLeveling": "Volume leveling",
  "volume.sheet.a11y": "Volume leveling",
  "volume.title": "Volume leveling",
  "volume.intro":
    "Recordings are made at different loudness. With this on, the app moves them toward one common level, so the next track never jumps out at you.",
  "volume.switch": "Level the volume",
  "volume.switch.sub": "Loud and quiet recordings sound about equally loud",
  "volume.note.phone":
    "On a phone the app can only turn the volume down, never up. A quiet recording plays as it is, and the common level is set a little lower so that most recordings can be turned down to meet it.",
  "volume.note.web":
    "In the browser the app can also raise a quiet recording, as far as it can without distorting the sound.",
  "volume.note.speech":
    "Spoken recordings, such as discourses, have a level of their own: speech needs to be a little quieter than music to feel equally loud.",
  "volume.note.unmeasured": "A recording that has not been measured yet plays as it is.",
} as const

export const volumeEs = {
  "profile.volumeLeveling": "Nivelación de volumen",
  "volume.sheet.a11y": "Nivelación de volumen",
  "volume.title": "Nivelación de volumen",
  "volume.intro":
    "Las grabaciones tienen distinto volumen. Con esto activado, la app las acerca a un nivel común, y así la siguiente pista nunca suena de golpe más fuerte.",
  "volume.switch": "Nivelar el volumen",
  "volume.switch.sub": "Las grabaciones fuertes y suaves suenan casi igual de fuerte",
  "volume.note.phone":
    "En el teléfono la app solo puede bajar el volumen, nunca subirlo. Una grabación suave suena tal como es, y el nivel común se fija un poco más bajo para que la mayoría de las grabaciones puedan bajarse hasta él.",
  "volume.note.web":
    "En el navegador la app también puede subir una grabación suave, hasta donde se pueda sin distorsionar el sonido.",
  "volume.note.speech":
    "Las grabaciones habladas, como los discursos, tienen su propio nivel: la voz debe sonar un poco más baja que la música para parecer igual de fuerte.",
  "volume.note.unmeasured": "Una grabación que aún no se ha medido suena tal como es.",
} as const

export const volumeRu = {
  "profile.volumeLeveling": "Выравнивание громкости",
  "volume.sheet.a11y": "Выравнивание громкости",
  "volume.title": "Выравнивание громкости",
  "volume.intro":
    "Записи сделаны с разной громкостью. Когда это включено, приложение приводит их к одному общему уровню, и следующая запись не бьёт по ушам.",
  "volume.switch": "Выравнивать громкость",
  "volume.switch.sub": "Громкие и тихие записи звучат примерно одинаково",
  "volume.note.phone":
    "На телефоне приложение умеет только убавлять громкость, но не прибавлять. Тихая запись играет как есть, а общий уровень выбран чуть ниже, чтобы большинство записей можно было убавить до него.",
  "volume.note.web":
    "В браузере приложение может ещё и прибавить громкость тихой записи, пока звук не начнёт искажаться.",
  "volume.note.speech":
    "У записей речи, например бесед, свой уровень: чтобы казаться такой же громкой, речь должна звучать чуть тише музыки.",
  "volume.note.unmeasured": "Запись, которую ещё не измерили, играет как есть.",
} as const
