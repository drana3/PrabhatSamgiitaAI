/**
 * Strings of the "How to pronounce" memo (components/song-page/Pronunciation.tsx). English is the source of truth;
 * ru and es mirror it key for key (the parity test checks them once these objects are spread into locales/en.ts,
 * ru.ts and es.ts). The Russian and Spanish lines are machine translations that no native speaker has read: they
 * are listed as unreviewed in locales/review.json until someone does.
 *
 * Per rule of data/pronunciation: `pron.<id>.text` (what the rule says) and, for rules with `like: true`,
 * `pron.<id>.like` (an approximate equivalent in the reader's own language). The facts come from the sources named
 * in data/pronunciation/sources.ts; nothing is added from memory. The "like" lines are approximations by design.
 */
export const pronunciationEn = {
  // ---- the sheet
  "pron.entry": "How to pronounce",
  "pron.entry.sub": "Hear the letters of this song",
  "pron.entry.a11y": "How to pronounce the letters of this song",
  "pron.chip": "Pronunciation",
  "pron.chip.a11y": "How to sing this song correctly: open the pronunciation memo",
  "pron.title": "How to pronounce",
  "pron.close": "Close",
  "pron.lang.a11y": "Language of the memo",
  "pron.lang.bengali": "Bengali",
  "pron.lang.sanskrit": "Sanskrit",
  "pron.intro.bengali": "How the Roman letters of a Bengali song sound. Tap a speaker to hear a word from the lyrics.",
  "pron.intro.sanskrit": "How the Roman letters of a Sanskrit verse sound. Tap a speaker to hear a word from the lyrics.",
  "pron.guess.bengali": "Showing Bengali, the language this song seems to be in. Switch above if it is not.",
  "pron.guess.sanskrit": "Showing Sanskrit, the language this song seems to be in. Switch above if it is not.",
  "pron.guess.both": "This song has Sanskrit and Bengali lines. Switch above to hear the other language.",
  "pron.audio.computer": "The sounds are made by a computer voice and are approximate. Recordings by a native speaker are planned.",
  "pron.audio.sanskrit": "The Sanskrit sounds are read by a Hindi computer voice, which may drop a final a that Sanskrit keeps.",
  "pron.unchecked": "No native speaker has checked this memo yet.",
  "pron.section.general": "The basics",
  "pron.section.inSong": "Letters in this song",
  "pron.section.all": "All letters",
  "pron.section.none": "None of the letters of this memo were found in the text of this song.",
  "pron.group.vowel": "Vowel",
  "pron.group.consonant": "Consonant",
  "pron.group.sibilant": "Sibilant",
  "pron.group.nasal": "Nasal",
  "pron.group.special": "Special sign",
  "pron.example": "Example",
  "pron.like": "Close to",
  "pron.ipa": "IPA",
  "pron.songNumber": "Song {number}",
  "pron.check": "Needs a native-speaker check",
  "pron.play": "Play {word}",
  "pron.stop": "Stop {word}",
  "pron.error": "This device could not play the sound.",
  "pron.sources": "Sources",
  "pron.sources.body": "Sarkarverse (the Roman key), Wikipedia and Wiktionary. Every rule names its sources in the documentation of the app.",

  // ---- the cheat-sheet
  "pron.cs.you": "You see",
  "pron.cs.sounds": "It sounds like",
  "pron.cs.voice": "The sounds are a computer voice, close but not exact.",
  "pron.cs.group.vowel": "Vowels",
  "pron.cs.group.consonant": "Consonants",
  "pron.cs.group.nasal": "Nose sounds",
  "pron.cs.group.sibilant": "S and sh sounds",
  "pron.cs.group.special": "Special signs",
  "pron.cs.group.general": "Good to know",
  "pron.cs.group.a11y": "{group}: {count} rules",
  "pron.cs.inSong": "{count} in this song",
  "pron.cs.row.a11y": "{symbols}: show details",
  "pron.cs.checking": "being checked",
  "pron.cs.hear": "Words to hear",
  "pron.cs.footer": "A native speaker is still checking {count} of the {total} rules. They say “being checked”.",

  // ---- Bengali: the basics
  "pron.bn.g.roman.text":
    "The Roman text spells the Bengali letters, not the sounds. So i and ii sound the same, u and ú sound the same, and sh, ś and s are usually the same sound too.",
  "pron.bn.g.inherent.text":
    "A plain a is the letter অ. It is not the English “ah”: it sounds like a rounded o, sometimes a little closer. The long vowel is written á.",
  "pron.bn.g.final.text":
    "At the end of a word the inherent vowel is often not said: পথ is “path”, not “patha”. It stays after a cluster of consonants or after h. Which sung words keep it needs a native speaker.",
  "pron.bn.g.length.text": "i and ii are two spellings of one sound, and so are u and ú. Bengali does not tell a long and a short vowel apart here.",
  "pron.bn.g.stress.text": "In Bengali the stress usually falls on the first syllable of a word.",
  "pron.bn.g.aspirate.text":
    "An h after a consonant (kh, gh, ch, jh, th, dh, ph, bh) is not a separate h: it is a puff of breath on the same sound. ph and bh are often said like f and v.",
  "pron.bn.g.nasalvowel.text":
    "A nasal vowel (chandrabindu) is said through the nose. The key writes it ṋ, but this catalogue never uses that sign; an n before a consonant may hide one.",

  // ---- Bengali: vowels
  "pron.bn.a.text": "The letter অ: an open, rounded o.",
  "pron.bn.a.like": "Like the vowel of “law”, but short.",
  "pron.bn.aa.text": "The letter আ: a long open a.",
  "pron.bn.aa.like": "Like the a in “father”.",
  "pron.bn.i.text": "The letters ই and ঈ: both are the same clear i.",
  "pron.bn.i.like": "Like the ee in “see”.",
  "pron.bn.u.text": "The letters উ and ঊ: both are the same u.",
  "pron.bn.u.like": "Like the oo in “food”.",
  "pron.bn.e.text":
    "The letter এ: usually a close e; in the first syllable it can be open (এক). The Roman text writes e for both, so only a native speaker can say which words take the open sound.",
  "pron.bn.e.like": "Between the e in “bed” and the ay in “say”.",
  "pron.bn.o.text": "The letter ও: a close o.",
  "pron.bn.o.like": "Like the o in “go”, without the glide.",
  "pron.bn.ae.text": "The letter ঐ: a diphthong, o gliding to i.",
  "pron.bn.ae.like": "Like the oy in “boy”.",
  "pron.bn.ao.text":
    "The letter ঔ: a diphthong, o gliding to u. Take care: in words like nao and kao the a and o are two separate vowels, and the text does not tell them apart.",
  "pron.bn.ao.like": "Like the o in “go”, ending in u.",
  "pron.bn.diph.text": "ai, oi, ei and ui are two vowels said as one glide.",
  "pron.bn.diph.like": "ai like “eye”, oi like “boy”, ei like “day”.",
  "pron.bn.ri.text": "The letter ঋ: r followed by i. The Roman text writes it r or ri, so the text cannot show where it is.",
  "pron.bn.ri.like": "Like “ri” in “rich”.",

  // ---- Bengali: consonants
  "pron.bn.velar.text": "ক খ গ ঘ: k, kh, g, gh. The h is a puff of breath on the same sound.",
  "pron.bn.velar.like": "k and g as in “skin” and “go”; kh and gh the same with a puff of breath.",
  "pron.bn.palatal.text": "চ ছ জ ঝ: c, ch, j, jh. The h is a puff of breath on the same sound.",
  "pron.bn.palatal.like": "c like “ch” in “chair”, j like “j” in “jam”; ch and jh with a puff of breath.",
  "pron.bn.retroflex.text": "ট ঠ ড ঢ: t́, t́h, d́, d́h, said with the tip of the tongue turned back. In Bengali they are not strongly retroflex.",
  "pron.bn.retroflex.like": "Close to English t and d.",
  "pron.bn.dental.text": "ত থ দ ধ: t, th, d, dh, said with the tongue against the teeth.",
  "pron.bn.dental.like": "Like t and d in Spanish or French.",
  "pron.bn.labial.text": "প ফ ব ভ: p, ph, b, bh. ph and bh are often said like f and v.",
  "pron.bn.labial.like": "p and b as in English; ph and bh with a breath, often like f and v.",
  "pron.bn.v.text": "The letter ব is written v or w in the Roman text, but it sounds like b.",
  "pron.bn.v.like": "Like the b in “bat”.",
  "pron.bn.y.text":
    "য় and য: y. Inside a word it is a soft glide; at the start of a word য is said like j. The key allows ya at the start to be written ja.",
  "pron.bn.y.like": "y as in “yes”; at the start of a word often j as in “jam”.",
  "pron.bn.r.text": "The letter র: a light tap of the tongue.",
  "pron.bn.r.like": "Like the r in Spanish “pero”.",
  "pron.bn.rr.text": "The letters ড় and ঢ় (written ŕ): a quick flick of the tongue tip, turned back.",
  "pron.bn.rr.like": "A quick r, a little like the dd in American “ladder”.",
  "pron.bn.n.text": "ন and ণ (n and ń): Bengali says both the same way.",
  "pron.bn.n.like": "Like the n in “no”.",
  "pron.bn.m.text": "ম and ল: m and l.",
  "pron.bn.m.like": "m as in “man”, l as in “let”.",
  "pron.bn.h.text": "The letter হ: a soft, breathy h.",
  "pron.bn.h.like": "Like the h in “hat”, softer.",

  // ---- Bengali: sibilants and nasals
  "pron.bn.sh.text": "The letter শ (sh).",
  "pron.bn.sh.like": "Like “sh” in “shoe”.",
  "pron.bn.ss.text": "The letter ষ (written ś): in Bengali it is the same sound as sh.",
  "pron.bn.ss.like": "Like “sh” in “shoe”.",
  "pron.bn.s.text":
    "The letter স (s): usually said like sh, but like s in some clusters and in loanwords (আস্তে against আসতে). Each word has to be learned.",
  "pron.bn.s.like": "Mostly “sh” as in “shoe”; sometimes “s” as in “sun”.",
  "pron.bn.anusvara.text": "The sign ং (written ḿ): a nasal at the end of a syllable, as in বাংলা.",
  "pron.bn.anusvara.like": "Like “ng” in “song”.",
  "pron.bn.nga.text": "The letter ঙ, written un before k or g (saunge), or ng.",
  "pron.bn.nga.like": "Like “ng” in “song”.",
  "pron.bn.nya.text":
    "The letter ঞ, which the catalogue writes in before c or j (jhainjhá). This is our reading of the catalogue; a native speaker should confirm the sound.",
  "pron.bn.nya.like": "Close to “ny” in “canyon”.",

  // ---- Bengali: special signs
  "pron.bn.visarga.text":
    "The sign ঃ, written h after a vowel at the end of a word or before a consonant. At the end of a word it is silent or a faint breath; inside a word it doubles the next consonant (duhkhe).",
  "pron.bn.visarga.like": "A faint breath, or a held consonant.",
  "pron.bn.kss.text":
    "The cluster ক্ষ (kś). It is commonly described as a long kh. No source we opened gives its sound, so it needs a native speaker.",
  "pron.bn.kss.like": "A long, strong kh.",
  "pron.bn.gy.text": "The cluster জ্ঞ (gy): a long g, as in অজ্ঞান.",
  "pron.bn.gy.like": "A held g, as in “big gate” said as one sound.",
  "pron.bn.yphala.text":
    "A y after a consonant (ya-phala) doubles that consonant and opens the vowel before it, as in ত্যাগ. Our words are applications by analogy; a native speaker should confirm them.",
  "pron.bn.yphala.like": "A held consonant and an open vowel, like the a in “cat”.",
  "pron.bn.vphala.text":
    "A v or w after a consonant (ba-phala) is silent and doubles that consonant, as in বিশ্ব. A native speaker should confirm our words.",
  "pron.bn.vphala.like": "No v is heard: the consonant is held longer.",
  "pron.bn.loan.text":
    "f, z and q are for words from Persian, Arabic and English. ph is often already said f; z is a loanword sound often replaced by j. How a singer says them is not settled.",
  "pron.bn.loan.like": "f as in “fan”, z as in “zoo”.",

  // ---- Sanskrit: the basics
  "pron.sa.g.roman.text":
    "The Roman text follows the Sarkar key: á, ii and ú are long vowels; sh is श and ś is ष; t́, d́ and ń are retroflex; ḿ is the nasal sign.",
  "pron.sa.g.length.text":
    "Sanskrit keeps the length of its vowels: a and á, i and ii, u and ú are different sounds. A long vowel lasts about twice as long as a short one.",
  "pron.sa.g.final.text":
    "A final a is always said in Sanskrit (sarva); it is not dropped as in Bengali. The computer voice may drop it, because it reads Hindi.",
  "pron.sa.g.stress.text":
    "In Classical Sanskrit the stress depends on the weight of the syllables, counted from the end of the word; Vedic had a pitch accent. How these verses are sung is not settled here.",
  "pron.sa.g.aspirate.text":
    "An h after a consonant (kh, gh, ch, jh, th, dh, ph, bh) is not a separate h: it is a puff of breath on the same sound.",

  // ---- Sanskrit: vowels
  "pron.sa.a.text": "The letter अ: a short, relaxed a.",
  "pron.sa.a.like": "Like the a in “about”.",
  "pron.sa.aa.text": "The letter आ (á): a long a, about twice as long as a.",
  "pron.sa.aa.like": "Like the a in “father”.",
  "pron.sa.i.text": "The letter इ: a short i.",
  "pron.sa.i.like": "Like the ee in “see”, but short.",
  "pron.sa.ii.text": "The letter ई (ii): a long i.",
  "pron.sa.ii.like": "Like the ee in “see”, held.",
  "pron.sa.u.text": "The letter उ: a short u.",
  "pron.sa.u.like": "Like the oo in “food”, but short.",
  "pron.sa.uu.text": "The letter ऊ (ú): a long u.",
  "pron.sa.uu.like": "Like the oo in “food”, held.",
  "pron.sa.ri.text":
    "The letter ऋ: a vowel r. Many speakers say it ri or ru. The Roman text writes it r, ri or rr, so the text cannot show where it is. A native speaker should say which way is used here.",
  "pron.sa.ri.like": "An r with a very short i after it.",
  "pron.sa.e.text": "The letter ए: always long.",
  "pron.sa.e.like": "Like the ay in “say”, without the glide.",
  "pron.sa.o.text": "The letter ओ: always long.",
  "pron.sa.o.like": "Like the o in “go”, without the glide.",
  "pron.sa.ae.text": "The letter ऐ (ae): a then i, said as one sound.",
  "pron.sa.ae.like": "Like “eye”.",
  "pron.sa.ao.text": "The letter औ (ao): a then u, said as one sound. In some words the a and o are two separate vowels.",
  "pron.sa.ao.like": "Like “ow” in “cow”.",

  // ---- Sanskrit: consonants
  "pron.sa.velar.text": "क ख ग घ: k, kh, g, gh. The h is a puff of breath on the same sound.",
  "pron.sa.velar.like": "k and g as in “skin” and “go”; kh and gh the same with a puff of breath.",
  "pron.sa.palatal.text": "च छ ज झ: c, ch, j, jh. The h is a puff of breath on the same sound.",
  "pron.sa.palatal.like": "c like “ch” in “chair”, j like “j” in “jam”; ch and jh with a puff of breath.",
  "pron.sa.retroflex.text": "ट ठ ड ढ: t́, t́h, d́, d́h, said with the tip of the tongue turned back. Sanskrit tells them from the dental t and d.",
  "pron.sa.retroflex.like": "Like t and d with the tongue tip curled back.",
  "pron.sa.dental.text": "त थ द ध: t, th, d, dh, said with the tongue against the teeth.",
  "pron.sa.dental.like": "Like t and d in Spanish or French.",
  "pron.sa.labial.text": "प फ ब भ: p, ph, b, bh. The h is a puff of breath on the same sound.",
  "pron.sa.labial.like": "p and b as in English; ph and bh with a puff of breath.",
  "pron.sa.nasals.text": "न ण म: n (dental), ń (the tongue turned back) and m.",
  "pron.sa.nasals.like": "n as in “no”, m as in “man”; ń with the tongue curled back.",
  "pron.sa.nga.text": "The letter ङ, written un before k or g (shaunkara).",
  "pron.sa.nga.like": "Like “ng” in “song”.",
  "pron.sa.y.text": "The letter य (y).",
  "pron.sa.y.like": "Like the y in “yes”.",
  "pron.sa.rl.text": "र and ल: r and l.",
  "pron.sa.rl.like": "r rolled lightly, l as in “let”.",
  "pron.sa.v.text": "The letter व (v): between v and w.",
  "pron.sa.v.like": "Between “v” and “w”.",
  "pron.sa.h.text": "The letter ह: a breathy h.",
  "pron.sa.h.like": "Like the h in “hat”, softer.",

  // ---- Sanskrit: sibilants and special signs
  "pron.sa.sh.text": "The letter श (sh): a soft sh.",
  "pron.sa.sh.like": "Like “sh” in “shoe”, a little softer.",
  "pron.sa.ss.text": "The letter ष (written ś): sh with the tongue turned back. Sanskrit has three different s sounds.",
  "pron.sa.ss.like": "Like “sh” in “shoe”, with the tongue curled back.",
  "pron.sa.s.text": "The letter स (s).",
  "pron.sa.s.like": "Like the s in “sun”.",
  "pron.sa.anusvara.text":
    "The sign ं (written ḿ): a nasal that matches the consonant after it; at the end of a word it is commonly said as m. A native speaker should confirm.",
  "pron.sa.anusvara.like": "A nasal, usually “m” at the end of a word.",
  "pron.sa.visarga.text": "The sign ः (written h at the end of a word): an h, sometimes with an echo of the vowel before it (namah).",
  "pron.sa.visarga.like": "A breath of h after the vowel.",
  "pron.sa.kss.text":
    "The cluster क्ष (kś): k followed by ṣ. Many speakers say it differently; a native speaker should say how it is said here.",
  "pron.sa.kss.like": "k followed by “sh”.",
} as const

export const pronunciationRu: Readonly<Record<string, string>> = {
  // ---- окно
  "pron.entry": "Как произносить",
  "pron.entry.sub": "Послушать буквы этой песни",
  "pron.entry.a11y": "Как произносятся буквы этой песни",
  "pron.chip": "Произношение",
  "pron.chip.a11y": "Как правильно петь эту песню: открыть памятку по произношению",
  "pron.title": "Как произносить",
  "pron.close": "Закрыть",
  "pron.lang.a11y": "Язык памятки",
  "pron.lang.bengali": "Бенгальский",
  "pron.lang.sanskrit": "Санскрит",
  "pron.intro.bengali": "Как звучат латинские буквы бенгальской песни. Нажмите на динамик, чтобы услышать слово из текста.",
  "pron.intro.sanskrit": "Как звучат латинские буквы санскритского стиха. Нажмите на динамик, чтобы услышать слово из текста.",
  "pron.guess.bengali": "Показан бенгальский: похоже, что песня на этом языке. Если нет, переключите выше.",
  "pron.guess.sanskrit": "Показан санскрит: похоже, что песня на этом языке. Если нет, переключите выше.",
  "pron.guess.both": "В этой песне есть строки на санскрите и на бенгальском. Переключите выше, чтобы услышать другой язык.",
  "pron.audio.computer": "Звуки произносит компьютерный голос, они приблизительные. Записи носителя языка запланированы.",
  "pron.audio.sanskrit": "Санскритские звуки читает компьютерный голос хинди: он может не произнести конечную a, которую санскрит сохраняет.",
  "pron.unchecked": "Носитель языка пока не проверял эту памятку.",
  "pron.section.general": "Основное",
  "pron.section.inSong": "Буквы этой песни",
  "pron.section.all": "Все буквы",
  "pron.section.none": "В тексте этой песни не нашлось ни одной буквы из памятки.",
  "pron.group.vowel": "Гласная",
  "pron.group.consonant": "Согласная",
  "pron.group.sibilant": "Свистящая",
  "pron.group.nasal": "Носовая",
  "pron.group.special": "Особый знак",
  "pron.example": "Пример",
  "pron.like": "Похоже на",
  "pron.ipa": "МФА",
  "pron.songNumber": "Песня {number}",
  "pron.check": "Нужна проверка носителем языка",
  "pron.play": "Прослушать: {word}",
  "pron.stop": "Остановить: {word}",
  "pron.error": "Это устройство не смогло воспроизвести звук.",
  "pron.sources": "Источники",
  "pron.sources.body": "Sarkarverse (латинский ключ), Википедия и Викисловарь. Каждое правило называет свои источники в документации приложения.",

  // ---- the cheat-sheet
  "pron.cs.you": "Вы видите",
  "pron.cs.sounds": "Звучит как",
  "pron.cs.voice": "Звуки — компьютерный голос: близко, но не точно.",
  "pron.cs.group.vowel": "Гласные",
  "pron.cs.group.consonant": "Согласные",
  "pron.cs.group.nasal": "Носовые звуки",
  "pron.cs.group.sibilant": "Звуки с и ш",
  "pron.cs.group.special": "Особые знаки",
  "pron.cs.group.general": "Полезно знать",
  "pron.cs.group.a11y": "{group}: правил {count}",
  "pron.cs.inSong": "{count} в этой песне",
  "pron.cs.row.a11y": "{symbols}: показать подробности",
  "pron.cs.checking": "проверяется",
  "pron.cs.hear": "Слова для прослушивания",
  "pron.cs.footer": "Носитель языка ещё проверяет {count} правил из {total}. Они помечены словом «проверяется».",

  // ---- бенгальский: основное
  "pron.bn.g.roman.text":
    "Латиница передаёт буквы бенгальского письма, а не звуки. Поэтому i и ii звучат одинаково, u и ú тоже, а sh, ś и s обычно дают один и тот же звук.",
  "pron.bn.g.inherent.text":
    "Простая a — это буква অ. Это не английское «ах»: звучит как округлое «о», иногда чуть закрытее. Долгая гласная пишется á.",
  "pron.bn.g.final.text":
    "В конце слова скрытая гласная часто не произносится: পথ читается «path», а не «patha». После сочетания согласных или после h она остаётся. Какие слова в песне её сохраняют, должен сказать носитель языка.",
  "pron.bn.g.length.text": "i и ii — два написания одного звука, так же как u и ú. Бенгальский здесь не различает долгую и краткую гласную.",
  "pron.bn.g.stress.text": "В бенгальском ударение обычно падает на первый слог слова.",
  "pron.bn.g.aspirate.text":
    "h после согласной (kh, gh, ch, jh, th, dh, ph, bh) — не отдельный звук: это придыхание того же звука. ph и bh часто звучат как f и v.",
  "pron.bn.g.nasalvowel.text":
    "Носовая гласная (чандрабинду) произносится через нос. В ключе она пишется ṋ, но в этом каталоге такого знака нет; её может скрывать n перед согласной.",

  // ---- бенгальский: гласные
  "pron.bn.a.text": "Буква অ: открытое округлое «о».",
  "pron.bn.a.like": "Как гласная в английском «law», но короче.",
  "pron.bn.aa.text": "Буква আ: долгое открытое «а».",
  "pron.bn.aa.like": "Как «а» в слове «мама», но дольше.",
  "pron.bn.i.text": "Буквы ই и ঈ: обе дают один и тот же чёткий звук «и».",
  "pron.bn.i.like": "Как «и» в слове «три».",
  "pron.bn.u.text": "Буквы উ и ঊ: обе дают один и тот же звук «у».",
  "pron.bn.u.like": "Как «у» в слове «душа».",
  "pron.bn.e.text":
    "Буква এ: обычно закрытое «е»; в первом слоге может быть открытым (এক). Латиница пишет e для обоих, поэтому только носитель языка скажет, в каких словах звук открытый.",
  "pron.bn.e.like": "Между «э» в слове «этот» и «е» в слове «лето».",
  "pron.bn.o.text": "Буква ও: закрытое «о».",
  "pron.bn.o.like": "Как ударное «о» в слове «кот».",
  "pron.bn.ae.text": "Буква ঐ: дифтонг, «о», переходящее в «и».",
  "pron.bn.ae.like": "Как «ой» в слове «бой».",
  "pron.bn.ao.text":
    "Буква ঔ: дифтонг, «о», переходящее в «у». Осторожно: в словах вроде nao и kao a и o — две отдельные гласные, и по тексту их не отличить.",
  "pron.bn.ao.like": "«о», переходящее в «у».",
  "pron.bn.diph.text": "ai, oi, ei и ui — две гласные, произносимые слитно.",
  "pron.bn.diph.like": "ai как «ай» в «чай», oi как «ой» в «бой», ei как «ей» в «день».",
  "pron.bn.ri.text": "Буква ঋ: «р», за которой следует «и». Латиница пишет её r или ri, поэтому по тексту не видно, где она.",
  "pron.bn.ri.like": "Как «ри» в слове «рис».",

  // ---- бенгальский: согласные
  "pron.bn.velar.text": "ক খ গ ঘ: k, kh, g, gh. h — это придыхание того же звука.",
  "pron.bn.velar.like": "k и g как «к» и «г»; kh и gh — то же, с придыханием.",
  "pron.bn.palatal.text": "চ ছ জ ঝ: c, ch, j, jh. h — это придыхание того же звука.",
  "pron.bn.palatal.like": "c как «ч», j как «дж» в слове «джаз»; ch и jh — с придыханием.",
  "pron.bn.retroflex.text": "ট ঠ ড ঢ: t́, t́h, d́, d́h; кончик языка отогнут назад. В бенгальском они выражены слабо.",
  "pron.bn.retroflex.like": "Близко к «т» и «д».",
  "pron.bn.dental.text": "ত থ দ ধ: t, th, d, dh; язык прижат к зубам.",
  "pron.bn.dental.like": "Как русские «т» и «д».",
  "pron.bn.labial.text": "প ফ ব ভ: p, ph, b, bh. ph и bh часто звучат как f и v.",
  "pron.bn.labial.like": "p и b как «п» и «б»; ph и bh — с придыханием, часто как «ф» и «в».",
  "pron.bn.v.text": "Буква ব пишется в латинице v или w, но звучит как «б».",
  "pron.bn.v.like": "Как «б» в слове «бак».",
  "pron.bn.y.text":
    "য় и য: y. Внутри слова это мягкий скользящий звук; в начале слова য читается как «дж». Ключ позволяет писать начальное ya как ja.",
  "pron.bn.y.like": "y как «й»; в начале слова часто «дж».",
  "pron.bn.r.text": "Буква র: лёгкий одиночный удар языка.",
  "pron.bn.r.like": "Как короткое «р» в слове «гора».",
  "pron.bn.rr.text": "Буквы ড় и ঢ় (пишутся ŕ): быстрый щелчок кончика языка, отогнутого назад.",
  "pron.bn.rr.like": "Быстрое «р».",
  "pron.bn.n.text": "ন и ণ (n и ń): в бенгальском оба произносятся одинаково.",
  "pron.bn.n.like": "Как «н» в слове «нос».",
  "pron.bn.m.text": "ম и ল: m и l.",
  "pron.bn.m.like": "m как «м», l как «л».",
  "pron.bn.h.text": "Буква হ: мягкое придыхательное h.",
  "pron.bn.h.like": "Как мягкое «х».",

  // ---- бенгальский: свистящие и носовые
  "pron.bn.sh.text": "Буква শ (sh).",
  "pron.bn.sh.like": "Как «ш».",
  "pron.bn.ss.text": "Буква ষ (пишется ś): в бенгальском это тот же звук, что и sh.",
  "pron.bn.ss.like": "Как «ш».",
  "pron.bn.s.text":
    "Буква স (s): обычно звучит как sh, но как s в некоторых сочетаниях и в заимствованиях (আস্তে против আসতে). Каждое слово нужно учить отдельно.",
  "pron.bn.s.like": "Чаще «ш»; иногда «с».",
  "pron.bn.anusvara.text": "Знак ং (пишется ḿ): носовой звук в конце слога, как в слове বাংলা.",
  "pron.bn.anusvara.like": "Носовое «нг», как в английском «song».",
  "pron.bn.nga.text": "Буква ঙ; пишется un перед k или g (saunge) либо ng.",
  "pron.bn.nga.like": "Носовое «нг», как в английском «song».",
  "pron.bn.nya.text":
    "Буква ঞ; каталог пишет её in перед c или j (jhainjhá). Это наше прочтение каталога; звук должен подтвердить носитель языка.",
  "pron.bn.nya.like": "Близко к «нь».",

  // ---- бенгальский: особые знаки
  "pron.bn.visarga.text":
    "Знак ঃ; пишется h после гласной в конце слова или перед согласной. В конце слова он не слышен или слышен как лёгкий выдох; внутри слова удваивает следующую согласную (duhkhe).",
  "pron.bn.visarga.like": "Лёгкий выдох или долгая согласная.",
  "pron.bn.kss.text":
    "Сочетание ক্ষ (kś). Обычно его описывают как долгое kh. Ни один открытый нами источник не даёт его звучания, поэтому нужен носитель языка.",
  "pron.bn.kss.like": "Долгое, сильное «кх».",
  "pron.bn.gy.text": "Сочетание জ্ঞ (gy): долгое g, как в слове অজ্ঞান.",
  "pron.bn.gy.like": "Долгое «г».",
  "pron.bn.yphala.text":
    "y после согласной (я-фала) удваивает эту согласную и открывает предыдущую гласную, как в ত্যাগ. Наши слова — применение по аналогии; носитель языка должен их подтвердить.",
  "pron.bn.yphala.like": "Долгая согласная и открытая гласная, близкая к «э».",
  "pron.bn.vphala.text":
    "v или w после согласной (ба-фала) не произносится и удваивает эту согласную, как в বিশ্ব. Наши слова должен подтвердить носитель языка.",
  "pron.bn.vphala.like": "«в» не слышно: согласная звучит дольше.",
  "pron.bn.loan.text":
    "f, z и q нужны для слов из персидского, арабского и английского. ph часто и так звучит как f; z — звук заимствований, его часто заменяют на j. Как их произносят певцы, не установлено.",
  "pron.bn.loan.like": "f как «ф», z как «з».",

  // ---- санскрит: основное
  "pron.sa.g.roman.text":
    "Латиница следует ключу Саркара: á, ii и ú — долгие гласные; sh — это श, а ś — это ष; t́, d́ и ń — ретрофлексные; ḿ — знак носового звука.",
  "pron.sa.g.length.text":
    "В санскрите длина гласных сохраняется: a и á, i и ii, u и ú — разные звуки. Долгая гласная звучит примерно вдвое дольше краткой.",
  "pron.sa.g.final.text":
    "Конечная a в санскрите всегда произносится (sarva); она не пропадает, как в бенгальском. Компьютерный голос может её не произнести, потому что читает хинди.",
  "pron.sa.g.stress.text":
    "В классическом санскрите ударение зависит от тяжести слогов, считая от конца слова; в ведическом было музыкальное ударение. Как эти стихи поются, здесь не установлено.",
  "pron.sa.g.aspirate.text":
    "h после согласной (kh, gh, ch, jh, th, dh, ph, bh) — не отдельный звук: это придыхание того же звука.",

  // ---- санскрит: гласные
  "pron.sa.a.text": "Буква अ: краткое, расслабленное «а».",
  "pron.sa.a.like": "Как безударное «а» в слове «вода».",
  "pron.sa.aa.text": "Буква आ (á): долгое «а», примерно вдвое дольше a.",
  "pron.sa.aa.like": "Как «а» в слове «мама», но дольше.",
  "pron.sa.i.text": "Буква इ: краткое «и».",
  "pron.sa.i.like": "Как «и», но коротко.",
  "pron.sa.ii.text": "Буква ई (ii): долгое «и».",
  "pron.sa.ii.like": "Как «и», протяжно.",
  "pron.sa.u.text": "Буква उ: краткое «у».",
  "pron.sa.u.like": "Как «у», но коротко.",
  "pron.sa.uu.text": "Буква ऊ (ú): долгое «у».",
  "pron.sa.uu.like": "Как «у», протяжно.",
  "pron.sa.ri.text":
    "Буква ऋ: гласное «р». Многие произносят её как «ри» или «ру». Латиница пишет её r, ri или rr, поэтому по тексту не видно, где она. Как её произносят здесь, должен сказать носитель языка.",
  "pron.sa.ri.like": "«р» с очень коротким «и» после него.",
  "pron.sa.e.text": "Буква ए: всегда долгая.",
  "pron.sa.e.like": "Долгое закрытое «е», без скольжения.",
  "pron.sa.o.text": "Буква ओ: всегда долгая.",
  "pron.sa.o.like": "Долгое «о», без скольжения.",
  "pron.sa.ae.text": "Буква ऐ (ae): «а», затем «и», слитно.",
  "pron.sa.ae.like": "Как «ай».",
  "pron.sa.ao.text": "Буква औ (ao): «а», затем «у», слитно. В некоторых словах a и o — две отдельные гласные.",
  "pron.sa.ao.like": "Как «ау».",

  // ---- санскрит: согласные
  "pron.sa.velar.text": "क ख ग घ: k, kh, g, gh. h — это придыхание того же звука.",
  "pron.sa.velar.like": "k и g как «к» и «г»; kh и gh — то же, с придыханием.",
  "pron.sa.palatal.text": "च छ ज झ: c, ch, j, jh. h — это придыхание того же звука.",
  "pron.sa.palatal.like": "c как «ч», j как «дж» в слове «джаз»; ch и jh — с придыханием.",
  "pron.sa.retroflex.text": "ट ठ ड ढ: t́, t́h, d́, d́h; кончик языка отогнут назад. Санскрит отличает их от зубных t и d.",
  "pron.sa.retroflex.like": "«т» и «д» с языком, отогнутым назад.",
  "pron.sa.dental.text": "त थ द ध: t, th, d, dh; язык прижат к зубам.",
  "pron.sa.dental.like": "Как русские «т» и «д».",
  "pron.sa.labial.text": "प फ ब भ: p, ph, b, bh. h — это придыхание того же звука.",
  "pron.sa.labial.like": "p и b как «п» и «б»; ph и bh — с придыханием.",
  "pron.sa.nasals.text": "न ण म: n (зубное), ń (язык отогнут назад) и m.",
  "pron.sa.nasals.like": "n как «н», m как «м»; ń — с языком, отогнутым назад.",
  "pron.sa.nga.text": "Буква ङ; пишется un перед k или g (shaunkara).",
  "pron.sa.nga.like": "Носовое «нг», как в английском «song».",
  "pron.sa.y.text": "Буква य (y).",
  "pron.sa.y.like": "Как «й».",
  "pron.sa.rl.text": "र и ल: r и l.",
  "pron.sa.rl.like": "r — лёгкое «р», l — «л».",
  "pron.sa.v.text": "Буква व (v): между v и w.",
  "pron.sa.v.like": "Между «в» и «у» (как неслоговое «у»).",
  "pron.sa.h.text": "Буква ह: придыхательное h.",
  "pron.sa.h.like": "Как мягкое «х».",

  // ---- санскрит: свистящие и особые знаки
  "pron.sa.sh.text": "Буква श (sh): мягкое «ш».",
  "pron.sa.sh.like": "Как «ш», чуть мягче.",
  "pron.sa.ss.text": "Буква ष (пишется ś): «ш» с языком, отогнутым назад. В санскрите три разных звука s.",
  "pron.sa.ss.like": "Как «ш», с языком, отогнутым назад.",
  "pron.sa.s.text": "Буква स (s).",
  "pron.sa.s.like": "Как «с».",
  "pron.sa.anusvara.text":
    "Знак ं (пишется ḿ): носовой звук, подстраивающийся под следующую согласную; в конце слова его обычно произносят как m. Носитель языка должен это подтвердить.",
  "pron.sa.anusvara.like": "Носовой звук, в конце слова обычно «м».",
  "pron.sa.visarga.text": "Знак ः (пишется h в конце слова): звук h, иногда с эхом предыдущей гласной (namah).",
  "pron.sa.visarga.like": "Выдох «х» после гласной.",
  "pron.sa.kss.text":
    "Сочетание क्ष (kś): k, затем ṣ. Многие произносят его иначе; как оно звучит здесь, должен сказать носитель языка.",
  "pron.sa.kss.like": "«к», затем «ш».",
}

export const pronunciationEs: Record<keyof typeof pronunciationEn, string> = {
  // ---- la hoja
  "pron.entry": "Cómo se pronuncia",
  "pron.entry.sub": "Escucha las letras de esta canción",
  "pron.entry.a11y": "Cómo se pronuncian las letras de esta canción",
  "pron.chip": "Pronunciación",
  "pron.chip.a11y": "Cómo cantar bien esta canción: abrir la guía de pronunciación",
  "pron.title": "Cómo se pronuncia",
  "pron.close": "Cerrar",
  "pron.lang.a11y": "Idioma de la guía",
  "pron.lang.bengali": "Bengalí",
  "pron.lang.sanskrit": "Sánscrito",
  "pron.intro.bengali": "Cómo suenan las letras latinas de una canción en bengalí. Toca un altavoz para oír una palabra de la letra.",
  "pron.intro.sanskrit": "Cómo suenan las letras latinas de un verso en sánscrito. Toca un altavoz para oír una palabra de la letra.",
  "pron.guess.bengali": "Se muestra el bengalí, el idioma en que parece estar la canción. Si no lo es, cambia arriba.",
  "pron.guess.sanskrit": "Se muestra el sánscrito, el idioma en que parece estar la canción. Si no lo es, cambia arriba.",
  "pron.guess.both": "Esta canción tiene versos en sánscrito y en bengalí. Cambia arriba para oír el otro idioma.",
  "pron.audio.computer": "Los sonidos los hace una voz de ordenador y son aproximados. Se planean grabaciones de un hablante nativo.",
  "pron.audio.sanskrit": "Los sonidos del sánscrito los lee una voz de ordenador en hindi, que puede omitir una a final que el sánscrito conserva.",
  "pron.unchecked": "Todavía ningún hablante nativo ha revisado esta guía.",
  "pron.section.general": "Lo básico",
  "pron.section.inSong": "Letras de esta canción",
  "pron.section.all": "Todas las letras",
  "pron.section.none": "No se encontró en el texto de esta canción ninguna de las letras de la guía.",
  "pron.group.vowel": "Vocal",
  "pron.group.consonant": "Consonante",
  "pron.group.sibilant": "Sibilante",
  "pron.group.nasal": "Nasal",
  "pron.group.special": "Signo especial",
  "pron.example": "Ejemplo",
  "pron.like": "Parecido a",
  "pron.ipa": "AFI",
  "pron.songNumber": "Canción {number}",
  "pron.check": "Necesita revisión de un hablante nativo",
  "pron.play": "Escuchar {word}",
  "pron.stop": "Detener {word}",
  "pron.error": "Este dispositivo no pudo reproducir el sonido.",
  "pron.sources": "Fuentes",
  "pron.sources.body": "Sarkarverse (la clave en letras latinas), Wikipedia y Wikcionario. Cada regla nombra sus fuentes en la documentación de la app.",

  // ---- the cheat-sheet
  "pron.cs.you": "Lo que ves",
  "pron.cs.sounds": "Suena como",
  "pron.cs.voice": "Los sonidos son de una voz de ordenador: cercanos, pero no exactos.",
  "pron.cs.group.vowel": "Vocales",
  "pron.cs.group.consonant": "Consonantes",
  "pron.cs.group.nasal": "Sonidos nasales",
  "pron.cs.group.sibilant": "Sonidos s y sh",
  "pron.cs.group.special": "Signos especiales",
  "pron.cs.group.general": "Conviene saber",
  "pron.cs.group.a11y": "{group}: {count} reglas",
  "pron.cs.inSong": "{count} en esta canción",
  "pron.cs.row.a11y": "{symbols}: ver detalles",
  "pron.cs.checking": "en revisión",
  "pron.cs.hear": "Palabras para escuchar",
  "pron.cs.footer": "Un hablante nativo todavía revisa {count} de las {total} reglas. Llevan la marca «en revisión».",

  // ---- bengalí: lo básico
  "pron.bn.g.roman.text":
    "El texto en letras latinas escribe las letras bengalíes, no los sonidos. Por eso i e ii suenan igual, u y ú suenan igual, y sh, ś y s suelen dar el mismo sonido.",
  "pron.bn.g.inherent.text":
    "Una a simple es la letra অ. No suena como la «a» española: suena como una o redondeada, a veces algo más cerrada. La vocal larga se escribe á.",
  "pron.bn.g.final.text":
    "Al final de una palabra la vocal inherente a menudo no se dice: পথ es «path», no «patha». Se mantiene tras un grupo de consonantes o tras h. Qué palabras cantadas la conservan debe decirlo un hablante nativo.",
  "pron.bn.g.length.text": "i e ii son dos formas de escribir un mismo sonido, igual que u y ú. El bengalí aquí no distingue vocal larga y corta.",
  "pron.bn.g.stress.text": "En bengalí el acento suele caer en la primera sílaba de la palabra.",
  "pron.bn.g.aspirate.text":
    "Una h tras una consonante (kh, gh, ch, jh, th, dh, ph, bh) no es una h aparte: es un soplo de aire sobre el mismo sonido. ph y bh suenan a menudo como f y v.",
  "pron.bn.g.nasalvowel.text":
    "Una vocal nasal (chandrabindu) se dice por la nariz. La clave la escribe ṋ, pero este catálogo nunca usa ese signo; una n ante consonante puede esconder una.",

  // ---- bengalí: vocales
  "pron.bn.a.text": "La letra অ: una o abierta y redondeada.",
  "pron.bn.a.like": "Como la vocal del inglés «law», pero más corta.",
  "pron.bn.aa.text": "La letra আ: una a larga y abierta.",
  "pron.bn.aa.like": "Como la a de «casa», pero más larga.",
  "pron.bn.i.text": "Las letras ই y ঈ: las dos dan la misma i clara.",
  "pron.bn.i.like": "Como la i de «sí».",
  "pron.bn.u.text": "Las letras উ y ঊ: las dos dan la misma u.",
  "pron.bn.u.like": "Como la u de «luz».",
  "pron.bn.e.text":
    "La letra এ: normalmente una e cerrada; en la primera sílaba puede ser abierta (এক). El texto latino escribe e para ambas, así que solo un hablante nativo puede decir qué palabras llevan el sonido abierto.",
  "pron.bn.e.like": "Entre la e de «mes» y la e de «de».",
  "pron.bn.o.text": "La letra ও: una o cerrada.",
  "pron.bn.o.like": "Como la o de «solo».",
  "pron.bn.ae.text": "La letra ঐ: un diptongo, o que se desliza hacia i.",
  "pron.bn.ae.like": "Como «oy» en «hoy».",
  "pron.bn.ao.text":
    "La letra ঔ: un diptongo, o que se desliza hacia u. Ojo: en palabras como nao y kao la a y la o son dos vocales separadas, y el texto no las distingue.",
  "pron.bn.ao.like": "Una o que termina en u.",
  "pron.bn.diph.text": "ai, oi, ei y ui son dos vocales dichas en un solo deslizamiento.",
  "pron.bn.diph.like": "ai como en «aire», oi como en «hoy», ei como en «peine».",
  "pron.bn.ri.text": "La letra ঋ: una r seguida de i. El texto latino la escribe r o ri, así que no se ve dónde está.",
  "pron.bn.ri.like": "Como «ri» en «río».",

  // ---- bengalí: consonantes
  "pron.bn.velar.text": "ক খ গ ঘ: k, kh, g, gh. La h es un soplo de aire sobre el mismo sonido.",
  "pron.bn.velar.like": "k y g como en «casa» y «gato»; kh y gh igual, con un soplo de aire.",
  "pron.bn.palatal.text": "চ ছ জ ঝ: c, ch, j, jh. La h es un soplo de aire sobre el mismo sonido.",
  "pron.bn.palatal.like": "c como «ch» en «chico», j como la «j» inglesa de «jam»; ch y jh con un soplo de aire.",
  "pron.bn.retroflex.text": "ট ঠ ড ঢ: t́, t́h, d́, d́h, con la punta de la lengua echada hacia atrás. En bengalí no son muy marcadas.",
  "pron.bn.retroflex.like": "Cerca de la t y la d.",
  "pron.bn.dental.text": "ত থ দ ধ: t, th, d, dh, con la lengua contra los dientes.",
  "pron.bn.dental.like": "Como la t y la d del español.",
  "pron.bn.labial.text": "প ফ ব ভ: p, ph, b, bh. ph y bh suenan a menudo como f y v.",
  "pron.bn.labial.like": "p y b como en español; ph y bh con soplo, a menudo como f y v.",
  "pron.bn.v.text": "La letra ব se escribe v o w en el texto latino, pero suena como b.",
  "pron.bn.v.like": "Como la b de «barco».",
  "pron.bn.y.text":
    "য় y য: y. Dentro de la palabra es un deslizamiento suave; al empezar la palabra, য se dice como j. La clave permite escribir ya inicial como ja.",
  "pron.bn.y.like": "y como en «yo»; al empezar la palabra, a menudo la j inglesa de «jam».",
  "pron.bn.r.text": "La letra র: un toque ligero de la lengua.",
  "pron.bn.r.like": "Como la r de «pero».",
  "pron.bn.rr.text": "Las letras ড় y ঢ় (se escriben ŕ): un golpe rápido de la punta de la lengua, echada hacia atrás.",
  "pron.bn.rr.like": "Una r rápida.",
  "pron.bn.n.text": "ন y ণ (n y ń): el bengalí dice las dos igual.",
  "pron.bn.n.like": "Como la n de «no».",
  "pron.bn.m.text": "ম y ল: m y l.",
  "pron.bn.m.like": "m como en «mano», l como en «lado».",
  "pron.bn.h.text": "La letra হ: una h suave y aspirada.",
  "pron.bn.h.like": "Como una j muy suave.",

  // ---- bengalí: sibilantes y nasales
  "pron.bn.sh.text": "La letra শ (sh).",
  "pron.bn.sh.like": "Como la «ch» francesa de «chat».",
  "pron.bn.ss.text": "La letra ষ (se escribe ś): en bengalí es el mismo sonido que sh.",
  "pron.bn.ss.like": "Como la «ch» francesa de «chat».",
  "pron.bn.s.text":
    "La letra স (s): suele decirse como sh, pero como s en algunos grupos y en palabras prestadas (আস্তে frente a আসতে). Cada palabra hay que aprenderla.",
  "pron.bn.s.like": "Casi siempre «sh»; a veces «s».",
  "pron.bn.anusvara.text": "El signo ং (se escribe ḿ): una nasal al final de la sílaba, como en বাংলা.",
  "pron.bn.anusvara.like": "Como «ng» en el inglés «song».",
  "pron.bn.nga.text": "La letra ঙ; se escribe un ante k o g (saunge), o ng.",
  "pron.bn.nga.like": "Como «ng» en el inglés «song».",
  "pron.bn.nya.text":
    "La letra ঞ, que el catálogo escribe in ante c o j (jhainjhá). Es nuestra lectura del catálogo; un hablante nativo debe confirmar el sonido.",
  "pron.bn.nya.like": "Cerca de la ñ.",

  // ---- bengalí: signos especiales
  "pron.bn.visarga.text":
    "El signo ঃ, que se escribe h tras una vocal al final de la palabra o ante una consonante. Al final de la palabra es mudo o un soplo débil; dentro de la palabra duplica la consonante siguiente (duhkhe).",
  "pron.bn.visarga.like": "Un soplo débil, o una consonante sostenida.",
  "pron.bn.kss.text":
    "El grupo ক্ষ (kś). Suele describirse como una kh larga. Ninguna fuente que abrimos da su sonido, así que necesita a un hablante nativo.",
  "pron.bn.kss.like": "Una kh larga y fuerte.",
  "pron.bn.gy.text": "El grupo জ্ঞ (gy): una g larga, como en অজ্ঞান.",
  "pron.bn.gy.like": "Una g sostenida.",
  "pron.bn.yphala.text":
    "Una y tras consonante (ya-phala) duplica esa consonante y abre la vocal anterior, como en ত্যাগ. Nuestras palabras son aplicaciones por analogía; un hablante nativo debe confirmarlas.",
  "pron.bn.yphala.like": "Una consonante sostenida y una vocal abierta, cercana a la e.",
  "pron.bn.vphala.text":
    "Una v o w tras consonante (ba-phala) no se pronuncia y duplica esa consonante, como en বিশ্ব. Un hablante nativo debe confirmar nuestras palabras.",
  "pron.bn.vphala.like": "No se oye la v: la consonante dura más.",
  "pron.bn.loan.text":
    "f, z y q sirven para palabras del persa, el árabe y el inglés. ph ya suele decirse f; z es un sonido de préstamos que a menudo se cambia por j. Cómo las dice un cantante no está establecido.",
  "pron.bn.loan.like": "f como en «foto», z como la «z» inglesa de «zoo».",

  // ---- sánscrito: lo básico
  "pron.sa.g.roman.text":
    "El texto latino sigue la clave de Sarkar: á, ii y ú son vocales largas; sh es श y ś es ष; t́, d́ y ń son retroflejas; ḿ es el signo nasal.",
  "pron.sa.g.length.text":
    "El sánscrito conserva la duración de las vocales: a y á, i e ii, u y ú son sonidos distintos. Una vocal larga dura casi el doble que una corta.",
  "pron.sa.g.final.text":
    "Una a final siempre se dice en sánscrito (sarva); no se pierde como en bengalí. La voz de ordenador puede omitirla, porque lee hindi.",
  "pron.sa.g.stress.text":
    "En el sánscrito clásico el acento depende del peso de las sílabas, contadas desde el final de la palabra; el védico tenía un acento tonal. Cómo se cantan estos versos no está establecido aquí.",
  "pron.sa.g.aspirate.text":
    "Una h tras una consonante (kh, gh, ch, jh, th, dh, ph, bh) no es una h aparte: es un soplo de aire sobre el mismo sonido.",

  // ---- sánscrito: vocales
  "pron.sa.a.text": "La letra अ: una a corta y relajada.",
  "pron.sa.a.like": "Como la a inglesa de «about».",
  "pron.sa.aa.text": "La letra आ (á): una a larga, casi el doble que a.",
  "pron.sa.aa.like": "Como la a de «casa», pero más larga.",
  "pron.sa.i.text": "La letra इ: una i corta.",
  "pron.sa.i.like": "Como la i de «sí», pero breve.",
  "pron.sa.ii.text": "La letra ई (ii): una i larga.",
  "pron.sa.ii.like": "Como la i de «sí», sostenida.",
  "pron.sa.u.text": "La letra उ: una u corta.",
  "pron.sa.u.like": "Como la u de «luz», pero breve.",
  "pron.sa.uu.text": "La letra ऊ (ú): una u larga.",
  "pron.sa.uu.like": "Como la u de «luz», sostenida.",
  "pron.sa.ri.text":
    "La letra ऋ: una r vocal. Muchos la dicen ri o ru. El texto latino la escribe r, ri o rr, así que no se ve dónde está. Un hablante nativo debe decir cuál se usa aquí.",
  "pron.sa.ri.like": "Una r con una i muy breve detrás.",
  "pron.sa.e.text": "La letra ए: siempre larga.",
  "pron.sa.e.like": "Una e larga, sin deslizamiento.",
  "pron.sa.o.text": "La letra ओ: siempre larga.",
  "pron.sa.o.like": "Una o larga, sin deslizamiento.",
  "pron.sa.ae.text": "La letra ऐ (ae): a y luego i, dichas como un solo sonido.",
  "pron.sa.ae.like": "Como «ai» en «aire».",
  "pron.sa.ao.text": "La letra औ (ao): a y luego u, dichas como un solo sonido. En algunas palabras la a y la o son dos vocales separadas.",
  "pron.sa.ao.like": "Como «au» en «causa».",

  // ---- sánscrito: consonantes
  "pron.sa.velar.text": "क ख ग घ: k, kh, g, gh. La h es un soplo de aire sobre el mismo sonido.",
  "pron.sa.velar.like": "k y g como en «casa» y «gato»; kh y gh igual, con un soplo de aire.",
  "pron.sa.palatal.text": "च छ ज झ: c, ch, j, jh. La h es un soplo de aire sobre el mismo sonido.",
  "pron.sa.palatal.like": "c como «ch» en «chico», j como la «j» inglesa de «jam»; ch y jh con un soplo de aire.",
  "pron.sa.retroflex.text": "ट ठ ड ढ: t́, t́h, d́, d́h, con la punta de la lengua echada hacia atrás. El sánscrito las distingue de la t y la d dentales.",
  "pron.sa.retroflex.like": "t y d con la punta de la lengua hacia atrás.",
  "pron.sa.dental.text": "त थ द ध: t, th, d, dh, con la lengua contra los dientes.",
  "pron.sa.dental.like": "Como la t y la d del español.",
  "pron.sa.labial.text": "प फ ब भ: p, ph, b, bh. La h es un soplo de aire sobre el mismo sonido.",
  "pron.sa.labial.like": "p y b como en español; ph y bh con un soplo de aire.",
  "pron.sa.nasals.text": "न ण म: n (dental), ń (con la lengua hacia atrás) y m.",
  "pron.sa.nasals.like": "n como en «no», m como en «mano»; ń con la lengua hacia atrás.",
  "pron.sa.nga.text": "La letra ङ; se escribe un ante k o g (shaunkara).",
  "pron.sa.nga.like": "Como «ng» en el inglés «song».",
  "pron.sa.y.text": "La letra य (y).",
  "pron.sa.y.like": "Como la y de «yo».",
  "pron.sa.rl.text": "र y ल: r y l.",
  "pron.sa.rl.like": "r vibrante suave, l como en «lado».",
  "pron.sa.v.text": "La letra व (v): entre v y w.",
  "pron.sa.v.like": "Entre «v» y «w».",
  "pron.sa.h.text": "La letra ह: una h aspirada.",
  "pron.sa.h.like": "Como una j muy suave.",

  // ---- sánscrito: sibilantes y signos especiales
  "pron.sa.sh.text": "La letra श (sh): una sh suave.",
  "pron.sa.sh.like": "Como la «ch» francesa de «chat», algo más suave.",
  "pron.sa.ss.text": "La letra ष (se escribe ś): sh con la lengua hacia atrás. El sánscrito tiene tres sonidos s distintos.",
  "pron.sa.ss.like": "Como la «ch» francesa de «chat», con la lengua hacia atrás.",
  "pron.sa.s.text": "La letra स (s).",
  "pron.sa.s.like": "Como la s de «sol».",
  "pron.sa.anusvara.text":
    "El signo ं (se escribe ḿ): una nasal que se ajusta a la consonante siguiente; al final de la palabra suele decirse m. Un hablante nativo debe confirmarlo.",
  "pron.sa.anusvara.like": "Una nasal, normalmente «m» al final de la palabra.",
  "pron.sa.visarga.text": "El signo ः (se escribe h al final de la palabra): una h, a veces con un eco de la vocal anterior (namah).",
  "pron.sa.visarga.like": "Un soplo de h tras la vocal.",
  "pron.sa.kss.text":
    "El grupo क्ष (kś): k seguida de ṣ. Muchos lo dicen de otro modo; un hablante nativo debe decir cómo se dice aquí.",
  "pron.sa.kss.like": "k seguida de «sh».",
}
