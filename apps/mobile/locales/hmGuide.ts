/**
 * Plain-language guidance of the Harmonium page, the "Harmonium chords" page and the chords card of the song page
 * (decision of 11 November 2026: a first-time user must see what each page is for, how to use it and what each block
 * does, and the page must say so where a block is a sample). Merged into locales/songPage.ts, which is already
 * spread into locales/en.ts, ru.ts and es.ts, so the parity test covers them. English is the source.
 */
export const hmGuideEn = {
  "hmGuide.how": "How it works",
  "hmGuide.how.show": "Show how it works",
  "hmGuide.how.hide": "Hide how it works",

  "hmGuide.hm.purpose": "A practice keyboard. It shows where Sa and the other swaras sit on a harmonium, in the key you sing in.",
  "hmGuide.hm.step1": "Pick your Sa, the home note of your singing.",
  "hmGuide.hm.step2": "Tap a key. The big letters show its swara, the small line its note name.",
  "hmGuide.hm.step3": "Find the same key on your own harmonium and play it there.",
  "hmGuide.hm.saNote": "Your home note. The chords on a song page use it too.",
  "hmGuide.hm.last": "The key you tapped",
  "hmGuide.hm.keys": "Keyboard",
  "hmGuide.hm.keysNote": "One octave, C to C. Swara above, note below.",
  "hmGuide.hm.practiseNote": "Two example songs. They open the song's chords with the harmonium view on. If a song has no chords yet, its page says so.",

  "hmGuide.ch.purpose": "A chord is three keys pressed together. Pick a chord here and see which three keys to press on the harmonium.",
  "hmGuide.ch.step1": "Pick your Sa.",
  "hmGuide.ch.step2": "Pick a chord. Its three keys light up orange on the keyboard.",
  "hmGuide.ch.step3": "Press those three keys together. In a song, change chord where a new letter appears.",
  "hmGuide.ch.ideaNote": "Three short facts about playing chords. Read them once.",
  "hmGuide.ch.tryNote": "Pick your Sa, then a chord. The keyboard shows the keys to press.",
  "hmGuide.ch.pickChord": "Four basic chords. The letters change with your Sa.",
  "hmGuide.ch.example": "Example",
  "hmGuide.ch.exampleNote": "Press a chord when its letter is over a word. These lines are only an example: the letters and the swaras under the words are placeholders, not the chords of a real song.",
  "hmGuide.ch.songNote": "Real chords live on each song's page, and not every song has them yet. Chords are always optional.",

  "hmGuide.sp.guitar": "How to hold each chord. Dots are fingers, a circle is an open string, a cross is a string you skip.",
  "hmGuide.sp.harmonium": "The seven swaras of your Sa, with the harmonium note of each.",
  "hmGuide.sp.capoNote": "A capo is a clamp on the guitar neck. It raises every string, so easier shapes sound in the same key.",
  "hmGuide.sp.keyNote": "Sa is the note the song is built on. The chord letters move to match the key you pick.",
} as const

export const hmGuideRu: Readonly<Record<string, string>> = {
  "hmGuide.how": "Как это работает",
  "hmGuide.how.show": "Показать, как это работает",
  "hmGuide.how.hide": "Скрыть, как это работает",

  "hmGuide.hm.purpose": "Тренировочная клавиатура. Показывает, где на фисгармонии лежат Са и остальные свары в той тональности, в которой вы поёте.",
  "hmGuide.hm.step1": "Выберите свой Са, то есть ноту, с которой вы поёте.",
  "hmGuide.hm.step2": "Нажмите клавишу. Крупные буквы это её свара, мелкая строка это название ноты.",
  "hmGuide.hm.step3": "Найдите такую же клавишу на своей фисгармонии и сыграйте её там.",
  "hmGuide.hm.saNote": "Ваша основная нота. Аккорды на странице песни тоже берут её.",
  "hmGuide.hm.last": "Клавиша, которую вы нажали",
  "hmGuide.hm.keys": "Клавиатура",
  "hmGuide.hm.keysNote": "Одна октава, от C до C. Сверху свара, снизу нота.",
  "hmGuide.hm.practiseNote": "Две песни для примера. Они открывают аккорды песни с видом для фисгармонии. Если у песни ещё нет аккордов, её страница так и скажет.",

  "hmGuide.ch.purpose": "Аккорд это три клавиши, нажатые вместе. Выберите здесь аккорд и увидите, какие три клавиши нажать на фисгармонии.",
  "hmGuide.ch.step1": "Выберите свой Са.",
  "hmGuide.ch.step2": "Выберите аккорд. Три его клавиши загорятся оранжевым на клавиатуре.",
  "hmGuide.ch.step3": "Нажмите эти три клавиши вместе. В песне меняйте аккорд там, где появилась новая буква.",
  "hmGuide.ch.ideaNote": "Три коротких факта об игре аккордами. Прочтите один раз.",
  "hmGuide.ch.tryNote": "Выберите свой Са, потом аккорд. Клавиатура покажет, какие клавиши нажать.",
  "hmGuide.ch.pickChord": "Четыре простых аккорда. Буквы меняются вместе с вашим Са.",
  "hmGuide.ch.example": "Пример",
  "hmGuide.ch.exampleNote": "Нажимайте аккорд, когда его буква стоит над словом. Эти строки только пример: буквы и свары под словами условные, это не аккорды настоящей песни.",
  "hmGuide.ch.songNote": "Настоящие аккорды лежат на странице каждой песни, и есть они пока не у всех. Аккорды всегда необязательны.",

  "hmGuide.sp.guitar": "Как зажимать каждый аккорд. Точки это пальцы, кружок это открытая струна, крестик это струна, которую не играют.",
  "hmGuide.sp.harmonium": "Семь свар вашего Са и нота фисгармонии для каждой.",
  "hmGuide.sp.capoNote": "Каподастр это зажим на грифе гитары. Он поднимает все струны, поэтому более простые аккорды звучат в той же тональности.",
  "hmGuide.sp.keyNote": "Са это нота, на которой построена песня. Буквы аккордов сдвигаются вслед за выбранной тональностью.",
}

export const hmGuideEs: Record<keyof typeof hmGuideEn, string> = {
  "hmGuide.how": "Cómo funciona",
  "hmGuide.how.show": "Mostrar cómo funciona",
  "hmGuide.how.hide": "Ocultar cómo funciona",

  "hmGuide.hm.purpose": "Un teclado de práctica. Muestra dónde están Sa y los demás swaras en un armonio, en la tonalidad en la que cantas.",
  "hmGuide.hm.step1": "Elige tu Sa, la nota base de tu canto.",
  "hmGuide.hm.step2": "Toca una tecla. Las letras grandes muestran su swara y la línea pequeña el nombre de la nota.",
  "hmGuide.hm.step3": "Busca la misma tecla en tu propio armonio y tócala allí.",
  "hmGuide.hm.saNote": "Tu nota base. Los acordes de la página de una canción también la usan.",
  "hmGuide.hm.last": "La tecla que tocaste",
  "hmGuide.hm.keys": "Teclado",
  "hmGuide.hm.keysNote": "Una octava, de C a C. Swara arriba, nota abajo.",
  "hmGuide.hm.practiseNote": "Dos canciones de ejemplo. Abren los acordes de la canción con la vista de armonio. Si una canción aún no tiene acordes, su página lo dice.",

  "hmGuide.ch.purpose": "Un acorde son tres teclas pulsadas a la vez. Elige un acorde aquí y mira qué tres teclas pulsar en el armonio.",
  "hmGuide.ch.step1": "Elige tu Sa.",
  "hmGuide.ch.step2": "Elige un acorde. Sus tres teclas se iluminan en naranja en el teclado.",
  "hmGuide.ch.step3": "Pulsa esas tres teclas juntas. En una canción, cambia de acorde donde aparece una letra nueva.",
  "hmGuide.ch.ideaNote": "Tres datos breves sobre tocar acordes. Léelos una vez.",
  "hmGuide.ch.tryNote": "Elige tu Sa y luego un acorde. El teclado muestra las teclas que pulsar.",
  "hmGuide.ch.pickChord": "Cuatro acordes básicos. Las letras cambian con tu Sa.",
  "hmGuide.ch.example": "Ejemplo",
  "hmGuide.ch.exampleNote": "Pulsa un acorde cuando su letra está sobre una palabra. Estas líneas son solo un ejemplo: las letras y los swaras bajo las palabras son de relleno, no los acordes de una canción real.",
  "hmGuide.ch.songNote": "Los acordes reales están en la página de cada canción, y no todas los tienen todavía. Los acordes son siempre opcionales.",

  "hmGuide.sp.guitar": "Cómo sujetar cada acorde. Los puntos son dedos, un círculo es una cuerda al aire, una cruz es una cuerda que no se toca.",
  "hmGuide.sp.harmonium": "Los siete swaras de tu Sa, con la nota del armonio de cada uno.",
  "hmGuide.sp.capoNote": "Una cejilla es una pinza en el mástil de la guitarra. Sube todas las cuerdas, así que formas más fáciles suenan en la misma tonalidad.",
  "hmGuide.sp.keyNote": "Sa es la nota sobre la que se construye la canción. Las letras de los acordes se mueven según la tonalidad que elijas.",
}
