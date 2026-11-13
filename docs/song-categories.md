# Song categories: a proposal for all 5,018 songs

Status: proposal and machine draft, 2026-11-05. Branch `redesign/v2`. No app code was changed.
Everything under "Draft" below was produced by a script and **has not been reviewed by a human**. Nothing here
should reach the app as fact until Dada or an editor has checked it (see "Review workflow").

Short answer to "you have translation and meaning data, don't you?": yes for the English meaning of 5,015 of 5,018
songs (median 86 words, a real line-by-line translation, not a title). It is enough to sort songs by *feeling*,
*subject*, *time of day* and *season* with a rough but useful accuracy. It is **not** enough to sort by occasion or
festival, and it holds almost no editor-written themes today (4.7% of songs sit in a curated collection).

New files, all under `data/proposals/`:

| File | What it is |
| --- | --- |
| `song_taxonomy_v0.json` | The facets, the values, one-line definitions, and the seed lexicon. Hand-editable. |
| `classify_songs.py` | The offline pipeline (Python 3 + numpy only). `python3 data/proposals/classify_songs.py` |
| `audit_song_data.py`, `audit_v0.json` | The data audit that section 1 reports. |
| `song_categories_v0.json` | Per song: feeling, subject, time of day, season, imagery, source tags, curated tags, evidence words. **Draft.** |
| `review_queue_v0.csv`, `spot_check_sample_v0.csv` | Review sheets with empty reviewer columns. |
| `hand_check_v0.csv`, `pipeline_report_v0.json` | My 80 hand verdicts, and the coverage and histogram numbers. |

## 1. What the data really holds (audit)

Source: `data/generated/songs.json` (5,018 rows). I also read the live API: the 60 random songs I fetched had an
`english_meaning` identical to the file, so the file is a fair stand-in. `GET /songs` summaries confirm the same
sparse theme, occasion and mood fields.

| Field | Filled | Note |
| --- | --- | --- |
| `english_meaning` | 5,015 (99.9%) | missing: 4681, 5008, 5009 (5008 and 5009 are English-language songs) |
| `lyrics_original`, `lyrics_devanagari` | 5,017 | |
| `central_idea` | 40 (0.8%) | the official short statement; too few to use alone |
| `metadata_json.purport` | 40 | same 40 songs |
| `theme` | 7 | official English labels such as "Song of Liberation" |
| `mood`, `occasion`, `festival`, `season`, `meditation_context` | 0 | in the file. The API shows `mood: hopeful` for song 1 only |
| `difficulty`, `raga`, `tala`, `harmonium_notation`, `transliteration`, `hindi_meaning` | 0 | in the file |
| `metadata_json.category` | 4,725 | the source site's own tag: codes `K`, `D`, tala names, dialect names, "(Krsna)", "(Shiva)" |
| `metadata_json.date` | 5,007 | composition date, 1982 to 1990 |

Quality of `english_meaning`:

- Length: min 35, 5th percentile 64, median 86, 95th percentile 132, max 320 words. 107 songs are under 60 words,
  195 are over 150. **No stubs**: none is under 35 words and none just repeats the title or the first line.
- 153 songs carry two or more translation variants in one field, separated by a dashed or underscore line
  (for example 236, 1069). The pipeline scores only the first variant. These songs need a clean-up decision of their own.
- 4 songs carry an editor's note marker inside the text (for example 1472, "* Koyel is a small river ...").
- Provenance is not recorded per song. The content review guide wants translations "canonical or clearly labeled as
  AI-generated"; nothing in the data tells us which is which. Categories built on top inherit that doubt.
- It is addressed to the Beloved in almost every song ("O Lord", "You came"). That is why feeling and subject
  words overlap so much, and why one subject, "Devotion and the Beloved", ends up as the default for most songs.

Duplicates: no two songs have the same meaning or the same lyrics (one near-copy pair: 544 and 545, Jaccard 0.98).
140 title groups (378 songs) share a first line with at least one other song, up to 14 songs with the same title.
The category should therefore be keyed by song number, never by title.

Curated coverage (source-site collections, `theme_collections.json`, 69 collections):

| Kind | Collections | Songs | Note |
| --- | --- | --- | --- |
| language | 7 | 62 | Bengali dialect is hidden in the app (`hiddenCollectionLabels`) |
| theme | 32 | 119 | 37 of all 69 collections hold exactly one song |
| festival | 8 | 17 | |
| occasion | 15 | 21 | |
| season | 7 | 39 | |
| **Any collection** | 69 | **235 (4.7%)** | **4,783 songs (95.3%) are in none**; 36 songs are in two or more |

`mobile_category_songs.json` (the 10 Songs-tab mood chips) reaches 767 songs (15.3%), and 831 (16.6%) together with
the curated ones. It is itself a keyword search result (`scripts/build_mobile_category_songs.py`), not editor curation.

**Embeddings.** The FAISS index (5,018 songs, 15,292 chunks) lives only in production and needs an Azure or OpenAI
key to embed text (`apps/api/app/services/embedding_index.py`). I used no key and no network, so I did **not** use
embeddings. The only local model in the HuggingFace cache is a reranker, not an embedder. The pipeline is lexicon plus
TF-IDF self-training instead. Embeddings remain a later upgrade (Phase 3).

## 2. The proposed system

### 2.1 Principles

1. **Two layers, never mixed.** Layer 1 is *curated*: the source-site collections stay authoritative and keep their
   names. Layer 2 is *suggested*: auto-assigned facets, always labelled "Suggested", shown after the curated shelf.
2. **Navigation aids, not claims.** A category says "this song's English meaning talks about X". It never says what
   a song *means* doctrinally, and it never rewrites or paraphrases a lyric or meaning.
3. **Small.** Four browse facets with 4 to 9 values each. Imagery is search-only.
4. **Labels use the corpus' own words.** I checked label words against the meanings: "merging" (289 songs) over
   "union" (3), "grace" (427) over "prayer" (50), "dance" (656) over "celebration" (5), "light and darkness"
   (1,280 and 889), "path" (747), "tears" (372), "hope" (626). Diacritics follow the app (Krśńa, Bábá, Dhyána).
   Visible English text says "Kiirtan" with two i's.
5. **Honest fallbacks.** A song may have no feeling. A song with no specific subject stays under the default
   "Devotion and the Beloved" and is marked low confidence. We never force a label.

### 2.2 Facets at a glance

| Facet | App kind it feeds | Values | Single or multi | Derivable from the data? |
| --- | --- | --- | --- | --- |
| **Feeling** | mood | 7 | 1 primary + up to 2 secondary | Yes, machine draft, 78% of songs |
| **Subject** | theme | 9 (8 + default) | 1 primary + up to 2 secondary | Yes, machine draft; the default covers 62% |
| **Time of day** | mood | 4 | up to 2 | Yes, high precision, 17% of songs name an hour |
| **Season** | season | 5 | up to 2 | Yes, high precision, 7% of songs name a season |
| Imagery (search only) | none | 8 | up to 3 | Yes, keyword level, 27% of songs |
| Figure (Krsna, Shiva) | theme | 2 | multi | Yes, **deterministic** from the source tag |
| Language and dialect | language | 6 | multi | Yes, **deterministic** from the source tag |
| Form and tune (tala, ghazal type) | theme | 7 | multi | Yes, deterministic, 33 songs only |
| Period composed (year) | none, Learn and sort | 9 (1982 to 1990) | single | Yes, deterministic, 4,993 songs |
| Festival, Occasion | festival, occasion | curated only | multi | **No.** Not derivable from meanings |
| Singing style (`K` / `D` code) | none yet | ? | single | Raw codes carried, **legend unknown** |

What I could not derive, and will not pretend to: festivals and occasions (the meaning rarely names a ceremony; the
curated 17 and 21 songs stay the only source), the meaning of the plain `K` (2,116 songs) and `D` (2,440 songs) codes
(the repository does not document them; Dada should confirm before they get any public label), raga and tala for
almost every song, and difficulty.

### 2.3 Facet values (counts are draft: primary / including secondary)

"Reliability" is from my hand check (section 4): *better* = right on most of the few I read, *weak* = wrong or merely arguable on
about half, *mixed* = mostly acceptable but often debatable, *untested* = not enough read. `*` marks a title I read
in the hand check and agreed with the primary label. Examples are number and title only.

**Feeling** (the emotional stance; app kind "mood")

| App label | One-line definition | Songs | Reliability | Examples |
| --- | --- | --- | --- | --- |
| Longing and waiting | The singer searches for the Beloved, waits, calls out, or feels the distance. | 752 / 1114 | better | 24* BANDHU HE; 3734* TUMI YADI NÁHI ELE; 4452* ÁNDHÁR PÁTHÁRE KHUNJECHI |
| Nearness and merging | The Beloved has come or is close, and the singer merges in Him; love is fulfilled. | 1028 / 1511 | mixed | 1135* TOMÁRE DEKHECHI NAVA RÚPE; 4215* ÁLO JÁ TUMI D́HELE DIYE GE; 4417* KUNJA VITÁNE DAKŚINÁ PAVA |
| Grace and surrender | The singer offers themselves, asks for grace and mercy, or takes shelter at the feet. | 583 / 845 | better | 2665* ARÚPE CHILE TUMI RÚPE ESEC; 3316* TOMÁR CARAŃ TALE PRABHU; 8 ÁMI JETE CÁI, TUMI NIYE JA |
| Pain, tears and hope | The song speaks of sorrow, tears or fear, and of hope that continues through them. | 579 / 927 | untested | 21 TUMI ÁLO JHALAMALA PÚRŃIM; 49 D́ÁK DIYE JÁI JÁI JÁI; 409 GÁN GEYE JÁI TOMÁRE TUŚI |
| Joy and dance | Dance, laughter, play and the rhythm of delight. | 518 / 862 | better | 2961* ÁJI, MALAY PARASHE; 903* TUMI JAKHAN ESE CHILE; 401 NÁCERA TÁLE CHANDE GÁNE |
| Peace and stillness | Calm, silence, rest and quiet of the mind. | 165 / 269 | weak | 3858* EI, SNIGDHA SHARATE JHARÁ SH; 1027 TOMÁRE CÁI JE EKÁNTE; 516 JE TOMÁRE CÁY TOMÁ PÁNE |
| Strength and striving | Strength, determination and the call to rise, move forward and win. | 314 / 491 | weak | 1515* EKERI AHVÁNE SABE JÁGE ÁJ; 1783 JHAINJHÁ YADI ÁSE; 2368 TOMÁR RAUNGE RÁUNGA MISHIY |

**Subject** (what the song is built around; app kind "theme"). "Devotion and the Beloved" is the default and should
**not** be shown as a browse shelf: it would hold 62% of the library and say nothing.

| App label | One-line definition | Songs | Reliability | Examples |
| --- | --- | --- | --- | --- |
| Light and darkness | Darkness giving way to effulgence, the lamp, the dawn of knowledge. | 192 / 344 | better | 506* PRABHU ÁMÁY; 4452* ÁNDHÁR PÁTHÁRE KHUNJECHI; 746* NIJERE PHOT́ÁECHO TUMI |
| Nature and seasons | Flowers, moon, rivers, clouds, birds, the garden and the changing seasons. | 661 / 904 | better | 3858* EI, SNIGDHA SHARATE JHARÁ SH; 903* TUMI JAKHAN ESE CHILE; 2447* EI SANDHYÁ RAKTA RÁGE |
| Meditation and the inner world | The mind, ideation, concentration, the inner core and spiritual practice. | 178 / 333 | weak | 41 ÁNDHÁR PERIYE ÁPANI ESECH; 4810 TOMÁREI BHÁLOBÁSIÁCHI; 1494 SURABHITA PAVANE MANERI MADH |
| The path and the journey | Walking the road, the traveller, the guide, the goal and the way across. | 140 / 238 | weak | 1080* ÁLOKER EI JÁTRÁ PATHE; 3700* JIIVAN SARITÁ MOR, BAHE JÁY; 2869 GÁNER TARII MOR TOMÁKE SMA |
| Creation and the Infinite | The universe, time and space, the ocean of consciousness, what is beyond. | 272 / 452 | better | 3614* TOMÁR E GÁN ANÁDI KÁLER; 4197* SE NISHIITHE CHILUM EKELÁ; 2232* KON AJÁNÁ HOTE ESECHO BHÁ |
| Music, rhythm and song | Songs about singing, melody, the flute, the beat and the sound of the universe. | 225 / 390 | better | 2961* ÁJI, MALAY PARASHE; 294* (BANGLÁ TRANSLATION OF OWN; 4918* VEŃU BEJE CHILO SUR BHESE C |
| Humanity and society | People and society, freedom from bondage, service, justice and a new era. | 128 / 212 | weak | 4714* KŚAŃIKER PARASH TAVA; 1515* EKERI AHVÁNE SABE JÁGE ÁJ; 880 MÁNAVA SAMÁJ AVIBHÁJYA |
| Devotion and the Beloved | Direct address to the Lord, the Beloved or the Friend; the heart of the devotee. Used when no more specific subject stands out. | 3099 / 4082 | default | 4215* ÁLO JÁ TUMI D́HELE DIYE GE; 4510* TUMI SHUNE JÁO; 1282 TOMÁR PHELE ÁSÁ |
| Memory and the passing of time | Remembering, the passing of time, parting, and the end of life. | 84 / 159 | weak | 4065* TOMÁR ÁSÁR PATH CEYE; 14 ÁJ MANE PAŔE, ÁJ MANE PAŔE; 920 JHARÁ PÁTÁ KÁNDE? VANE |

**Time of day** (app kind "mood"; matches the existing Morning and Evening tiles)

| App label | One-line definition | Songs | | Examples |
| --- | --- | --- | --- | --- |
| Dawn and morning | Daybreak, sunrise and the morning. | 240 | - | 3843 JIIVANE ESE CHILO BHOR; 440 SE JE ESECHILO; 1163 MANERI GAHANE JE ESECHE NIJE |
| Daytime | Noon, afternoon and the bright day. | 51 | - | 4793 ÁMÁR, SONÁLI DINAGULI KOT; 4103 ÁMI, MANE PRÁŃE CÁI TOMA; 1507 SE CHILO ÁMÁR |
| Evening and twilight | Sunset, dusk and the evening. | 157 | - | 3340 E SHÁRAD SANDHYÁ NÁCE MADHU; 2795 TÁRÁR PRADIIPE DHARÁR SAM; 2142 SANDHYÁ TÁRÁ SANDHYÁ TÁ |
| Night and moonlit night | The night, midnight and the moonlit night. | 483 | - | 3685 JYOTSNÁ RÁTE TUMI ESE CHILE; 3747 TOMÁR TARE JIIVAN BHARE; 3724 ESE CHILE TUMI SE RÁTE |

**Season** (app kind "season"; curated season collections hold 39 songs, this adds 361, 27 shared)

| App label | One-line definition | Songs | | Examples |
| --- | --- | --- | --- | --- |
| Spring | Spring, the season of new blossoms and the south wind. | 94 | - | 406 ÁYO, RITUR RÁJÁ VASANTA; 103 VASANTA ÁJ JÁGLO; 3697 ÁKÁSHE CÁNDA JE HÁSE PHÁGUN |
| Summer | Summer and the hot, dry weather. | 31 | - | 108 RAODRER KHARATÁPE; 119 MEGH TUMI KÁCHE ESO; 4192 ÁMI JHARŃA DHÁRAY NÁCI G |
| Rainy season | Monsoon clouds, rain and thunder. | 114 | - | 3814 SEI VARŚÁ SNÁTA NISHIITHE; 533 ÁJI SRÁVAŃ GHAN GAHAN RÁ; 2824 VARŚÁ MUKHAR RÁTE DÁMINI |
| Autumn | Autumn: clear skies, white clouds, shiuli flowers (Sharat) and the mist-laden Hemanta. | 109 | - | 123 SHARAT AE ÁSE AE ÁSE AE Á; 4151 SHARAT ESECHE SHEFÁLI HESEC; 2668 JEO NÁ JEO NÁ |
| Winter | Winter, cold, mist and fog. | 62 | - | 96 SHISHIR SIKTA KHARJUR VIITHI; 1602 TOMÁR KATHÁ BHEVE BHEVE HO; 4319 MADHUMÁS ÁJO ÁSE NI |

**Imagery** (search only; a song may match up to 3; examples are top keyword scores, unread)

| App label | One-line definition | Songs | | Examples |
| --- | --- | --- | --- | --- |
| Flowers and fragrance | Blossoms, garlands, fragrance and the honey bee. | 349 | - | 395 NIIL SÁYARE SONÁR KAMAL; 322 TUMI ESE CHILE VARŚÁR RÁT; 389 PHÚLER VANETE BHRAMARÁ ESE |
| Moon, stars and sky | The moon, moonlight, stars and the open sky. | 182 | - | 38 SE JE ESECHE MOR HRIDAYE GUN; 772 SURA TARAUNGE MOHANA RAUNGE; 897 TUMI BHÁLOBÁSO BHÁLOBÁSITE J |
| River, ocean and waves | Rivers, the ocean, waves, springs and water. | 276 | - | 2826 KABHU SHUYE BASE KAKHANO DÁ; 2 E GÁN ÁMÁR, ÁLOR JHARAŃ; 752 ESECHO PURUŚOTTAMA ESECHO |
| Clouds, rain and storm | Clouds, rain, lightning, thunder, wind and storm. | 193 | - | 4233 TUMI ELE PRIYA; 3089 MEGHER PARE MEGH JAMECHE; 112 IISHÁN KOŃETE MEGH JAMIÁC |
| Birds and bees | Cuckoo, peacock, swan, parrot and the humming bee. | 162 | - | 3584 NIIL ÁKÁSHE OI BALÁKÁ; 1927 KENO SAJAL COKHE CEYE ÁCHO; 1757 SANDHYÁ BELÁY SANDHYÁ TÁ |
| Flute and instruments | The flute, lyre, drum and other instruments. | 64 | - | 2321 BHÁLO BÁSI ÁMI TOMÁRE; 3744 AMBARA MÁJHE D́AMBARU BÁJE; 35 ÁKÁSH VÁTÁS SUDHÁ NIRYA |
| Lamp, flame and sun | The lamp, flame, fire, torch and the sun. | 194 | - | 3733 JE ÁGUN JVELE GELE; 2970 DIIP JVELE JÁI, ÁNDHÁRE S; 797 TOMÁRE BHÁLOBÁSI TOMÁRI LÁGI |
| Mountains, forests and roads | Mountains, forests, deserts, roads and shores. | 189 | - | 4110 KENO, BHULIYÁ RAYECHO ÁMÁ; 1331 MEGHE PÁHÁŔE KHELÁ; 1309 MEGHERÁ KENO NIICE NEME |

**Deterministic source tags** (no model; read from `metadata_json.category` and the date)

| Tag | Songs | Compared with the curated list |
| --- | --- | --- |
| Krśńa songs | 97 | curated "Krśńa Songs" has 15; 6 overlap, 9 curated-only. Union 106 |
| Shiva songs | 31 | curated has 15; 8 overlap, 7 curated-only. Union 38 |
| Bengali dialect | 42 | curated 25, all contained (+17) |
| Hindi / Urdu | 20 | curated Hindi or Urdu: 17 songs, all contained (+3) |
| Sanskrit 15, Aungika 10, Magahii 1 | 26 | curated Sanskrit 9 (8 contained, +7), Aungika 7 (all contained, +3) |
| Tala or form (Trital 16, ghazal/qawwali type 12, Teorá 7, Jhaptál 4, Baetálik 3, Rúpak 1, Ektál 1) | 33 songs (some have two) | none curated |
| Year composed | 1982: 179, 1983: 946, 1984: 1,111, 1985: 1,050, 1986: 614, 1987: 316, 1988: 286, 1989: 141, 1990: 350 | 25 songs have no readable date |

Examples: Krśńa 661, 759, 1249; Shiva 1240, 1418, 1490; Hindi / Urdu 25, 4062, 4070; Sanskrit 2505, 2526, 3246.

### 2.4 Candidate values the clustering suggested (not in the draft)

K-means on the TF-IDF space (14 clusters, `pipeline_report_v0.json`) mostly re-found the taxonomy (light and darkness,
music and rhythm, garden and flowers, pain and pleasure, flute and Vraja). Two recurring clusters have **no home**
yet and are worth a Subject value after review:

- **The divine play** (~340 songs): "game", "play", "liila", "illusive", "sometimes ... sometimes". Candidate label "The divine play".
- **Preparing the welcome** (~320 songs): garland, threading, decorating, seat, altar, "come". Candidate label "Preparing for the Beloved's coming".

## 3. How it plugs into the app

### 3.1 The six collection kinds (`lib/songsV2/collectionsIndex.ts`)

| Kind | Layer 1: curated (stays authoritative) | Layer 2: suggested (new) |
| --- | --- | --- |
| festival | 8 collections, 17 songs | none (cannot be derived) |
| occasion | 15 collections, 21 songs | none |
| language | 7 collections, 62 songs | source-tag extension (Hindi / Urdu +3, dialect +17, Sanskrit +7, Aungika +3, Magahii +1), labelled as from the catalogue |
| theme | 32 collections, 119 songs | Subject facet (8 specific values, not the default), plus Krśńa and Shiva from source tags |
| season | 7 collections, 39 songs | Season facet (5 values), sorted after the curated ones |
| mood | the 6 special tiles (Kiirtan, Dhyána, Morning, Evening, Nature, Children) | Feeling facet (7) and Time of day (4); Morning, Evening, Nature, Dhyána map onto Dawn, Evening, Nature and seasons, Meditation |

Data shape (one file, bundled like `theme_collections.json`): an entry per suggested value
`{ kind, id, label, layer: "suggested", review: "machine" | "reviewed", songNumbers[] }`. `buildCollectionEntries`
needs one new field (`layer`) and a sort rule: curated first, suggested after. Counts are shown as today.

### 3.2 Songs tab (chips and shelves)

- Keep the current chips row. Add **one** shelf, "By feeling", of 7 chips, and one small row "By hour" of 4 chips,
  both after the festival chips. Everything else lives behind "All collections", which gains a layer filter:
  "All 68", "Curated 68", "Suggested 24".
- Only values that passed the review gate (section 6) are shown. A suggested chip carries a small "Suggested" tag;
  the collection page says "Suggested from the English meanings. Not part of the original catalogue."
- The 10 old mood chips come from keyword searches. After review, re-point them at Feeling and Subject
  (Nature, Morning, Evening, Rain, Peace map directly). Never mix two sources inside one chip.

### 3.3 Search

- Add the labels and their lexicon words to the instant local "feeling words" step (`lib/unifiedSearch.ts`), so
  "longing", "tears", "morning", "spring" return their collection immediately, offline, with the layer shown.
- Server meaning search (FAISS) is unchanged; reviewed categories are a free, cheap *filter* beside it ("Spring songs").

### 3.4 Learn

- The Learn song shelf has 7 hard-coded suggestions (`docs/learn-system.md`). Replace them with "Songs for this hour"
  (Time of day, Dawn in the morning) and "Songs for how you feel" (Feeling).
- `lyric_lines` (5th to 95th percentile 14 to 27 lines) is in the draft file as a plain number. A "short song to
  begin with" rule can use it; it is a better start than the empty `difficulty` field.

## 4. The pipeline and its hand check

### 4.1 Method (`classify_songs.py`, deterministic, about 10 seconds)

1. **Text**: first translation variant of `english_meaning`; `central_idea` counts double when present; the Roman
   lyrics and first line feed a handful of Bengali season and hour words (`vasanta`, `varsa`, `sharat`, `sandhya`,
   `nisha`). Light stemming, stop-words removed for the matrix.
2. **Seed lexicon** per value in `song_taxonomy_v0.json`: weighted words and two-word phrases from the corpus' own
   vocabulary. Score = sum of weight x (1 + ln count) x an idf factor that damps words found in most songs
   ("mind", "love", "come"), length-normalised.
3. **Self-training**: songs with a clear lexicon winner become pseudo-labels (Feeling about 1,490, Subject about
   560); a TF-IDF centroid per value is built from them (leave-one-out); the similarity z-score is added to the lexicon
   score. A song matched only by the centroid is marked `model-only` and capped at confidence 0.25.
4. **Default subject**: a specific subject must beat a "Devotion" baseline by a margin, else the song stays under the
   default with basis `default` and low confidence.
5. **Time, season, imagery**: lexicon only, multi-valued.
6. **Source tags**: plain string reading of the source category and date.
7. **Evidence**: each assignment stores the words that fired, so a reviewer sees *why*.

Output coverage (draft, 5,018 songs): Feeling assigned 3,939 (78.5%); Subject assigned 4,979 (99.2%), of which
1,880 specific and 3,099 default; Time of day 839; Season 361; Imagery 1,374; Krśńa or Shiva tag 128 (union with the curated lists: 144); at least one
non-default label of any layer: 4,526 songs (90.2%); only the default or nothing: 492.

Confidence histogram (relative rank, **not a probability**; min of the two facets, 5,007 songs with at least one):

| 0.0-0.2 | 0.2-0.3 | 0.3-0.4 | 0.4-0.5 | 0.5-0.6 | 0.6-1.0 |
| --- | --- | --- | --- | --- | --- |
| 189 | 3,411 | 1,110 | 225 | 54 | 18 |

Bands used in the file: high (>= 0.45) 54, medium 960, low 2,897, partial (only one facet) 1,096, uncovered 11.
Be clear about what this means: **the numeric confidence barely separates right from wrong.** In sample B the mean
subject confidence was 0.37 for agreed labels, 0.28 for acceptable and 0.33 for wrong ones. What does predict
quality is the *value*: see the reliability column. `review_priority` therefore subtracts 0.15 for weak values.

### 4.2 Hand check: 80 songs, read by me against `english_meaning`

I read the full English meaning of 40 songs (stratified: 4 per Subject value, plus 4 unlabelled), judged the pipeline,
**improved the pipeline once**, drew a fresh 40 (4 per specific Subject value, 8 default) and judged again. Verdicts:
**agree** = I would accept it as the primary; **acceptable** = arguable, a secondary would also fit; **wrong**.
One reader, one sitting, 40 songs: treat every figure as plus or minus 15 points.

| Sample | Pipeline | Facet | Assigned | Agree | Acceptable | Wrong |
| --- | --- | --- | --- | --- | --- | --- |
| A (40) | first pass | Subject | 36 | 14 (39%) | 6 (17%) | 16 (44%) |
| A | first pass | Feeling | 27 | 16 (59%) | 9 (33%) | 2 (7%) |
| B (40) | improved | Subject | 40 | 23 (57%) | 11 (28%) | 6 (15%) |
| B | improved | Feeling | 33 | 13 (39%) | 16 (48%) | 4 (12%) |

Also: first-pass Subject left 4 of 4 unlabelled songs that clearly had a devotional subject (all 4 now get the default);
first-pass Feeling left 13 of 40 unlabelled (7 clear misses). Improved Feeling left 7 of 40 (1 clear miss, song 4065).
Sample B is the fair number: sample A shaped the changes. Subject improved clearly; Feeling gained coverage
(68% to 83% of the sample) but its strict agreement fell, so call it unchanged, around 90% "agree or acceptable".

What I changed (one round): the Subject lexicon was too eager (incidental words such as "ocean", "human",
"remember", "lamp", "song", "path" set off specific subjects), so I lowered those weights and added the "Devotion"
default with a margin. I widened the Feeling lexicon and lowered its threshold.

Per-value result on sample B (A agree, B acceptable, W wrong): Subject: Light and darkness AAAA, Nature AAAA, Music
AAAB, Creation AAAB, Humanity AABW, The path AABB, Meditation BBWW, Memory AWWW, Devotion default AAAABBBB.
Feeling: Longing AAABBB, Grace and surrender AABBBB, Joy AABB, Nearness AAAABBBBBWW, Peace ABW, Strength ABW.
Four values per cell is a very small sample.

**Clear errors (wrong):**
- Subject: 3316 (Humanity; it is a song of repentance and grace, "humanity" appears once), 24 (Meditation; the Lord
  came and left, "too busy"), 4620 (Meditation; resort of the helpless, beacon in the dark ocean), 1519, 1148, 1138
  (Memory; "departed", "past", "memory" in a song of the Beloved's coming), and in sample A 1145, 3334, 4889, 2573,
  3034, 4886, 4433, 1327 and 432 (a fairy-tale song put under The path).
- Feeling: 4197 (Strength; a night song of the cosmos, "trumpet resounds"), 2038 (Nearness; "I cry for You ...
  come with light" is longing), 1138 (Peace), 1472 (Nearness; a song about a place, Palamau), 193, 3334.

**Failure modes to fix before the first real review:** (1) one incidental word (`ideation`, `departed`, `human`)
is enough to trigger a weak value; require two distinct evidence words for Meditation, Memory, Humanity, The path.
(2) "Nearness and merging" is overloaded: it catches every "You came" song and crowds out Longing and Grace.
(3) Feelings with no lexicon word (gratitude, wonder, awe: for example the Shiva tandava song 3671) get nothing.
(4) Courage and Peace use words the corpus rarely uses ("courage" 12 songs, "calm" 27); rename or merge after review.
(5) Negations: 4922 is tagged Spring because of "I do not want the southern breeze".

Time of day and Season were checked on the evidence words and their context (26 songs): 10 of 12 hour tags and 11
of 14 season tags were clearly right; the misses were incidental mentions (winter and spring nights in one line) and
one case of a spring-month name (4319 Madhumás) tagged Winter.

## 5. Counts per category (top of the draft)

Primary labels, draft, biggest first. Feeling: Nearness and merging 1,028; Longing and waiting 752; Grace and
surrender 583; Pain, tears and hope 579; Joy and dance 518; Strength and striving 314; Peace and stillness 165.
Subject (specific only): Nature and seasons 661; Creation and the Infinite 272; Music, rhythm and song 225; Light
and darkness 192; Meditation and the inner world 178; The path and the journey 140; Humanity and society 128;
Memory and the passing of time 84. Time of day: Night 483; Dawn 240; Evening 157; Daytime 51. Season: Rainy 114;
Autumn 109; Spring 94; Winter 62; Summer 31. For comparison, the largest curated collections are Women 28,
Bengali dialect 25, Urdu 16, Shiva 15, Krśńa 15.

## 6. Review workflow (light)

Goal: no label reaches users unreviewed, without asking anyone to read 5,018 songs.

1. **Spot check, 100 songs** (`spot_check_sample_v0.csv`, stratified by Subject, seeded, reproducible). Reviewer
   opens each song and writes `ok` or `change` plus the correct value. About 1 hour. **Gate:** Feeling and
   Subject both at least 85% `ok` or `acceptable`, else fix the lexicon and re-run; do not review further yet.
2. **Review queue** (`review_queue_v0.csv`), sorted by `review_priority` ascending: weak values first, then low
   confidence, then partial and uncovered. Work down it in blocks of 100; the file regenerates after lexicon edits.
3. **Per-value gate before display:** review 30 random songs of the value; if at least 85% are `ok` or `acceptable`,
   the whole value is shown as "Suggested"; otherwise only its reviewed songs are shown, or the value stays hidden.
4. **Promotion:** reviewed songs get `review: "reviewed"`; the curated layer is never overwritten.
5. **Capacity guess:** weak values hold about 1,000 songs; at 30 seconds a song that is about 8 hours, split between
   two people. Full review of everything is about 40 hours and is not needed for Phase 1 or 2.
6. Corrections feed back as lexicon edits (preferred, since they fix many songs) or per-song overrides stored in a
   separate `overrides` file that the pipeline applies last.

## 7. Plan

| Phase | What ships | Needs |
| --- | --- | --- |
| 0, now, no review | Source-tag shelves: Krśńa 97, Shiva 31, Hindi / Urdu, dialects, Sanskrit, Aungika, year composed; fix/extend counts of existing curated shelves | Dada confirms the source tags can extend the curated lists (decision 3) |
| 1, after the 100-song spot check | Season (5) and Time of day (4) as "Suggested"; Feeling values rated *better* (Longing, Grace and surrender, Joy) and Subject values rated *better* (Nature, Light, Music, Creation) | spot check, per-value gate |
| 2, after block review | Remaining Feeling and Subject values; Search hints; Learn "Songs for this hour"; Imagery as search filter | lexicon fixes in 4.2, reviewer time |
| 3, later | Embedding nearest-seed on the server (no key used in this work); use the reviewed labels as the test set; add "The divine play" and "Preparing for the Beloved's coming" | reviewed labels, embedding quota |

## 8. Risks

- **Sacred subject.** A wrong label on a song of Bábá is worse than none. Hence labels are navigation aids, framed
  "Suggested", never shown on the lyric screen, and always removable per song.
- **Authority confusion.** If the suggested layer looks like the catalogue, readers will think the editors chose it.
  The layer tag, the order and the page text are required, not cosmetic.
- **Pseudo-precision.** The confidence number looks scientific and is not. Do not show it; show nothing, or a
  reviewed/suggested state.
- **The default swallows the library.** 62% of songs are "Devotion". The facet is useful for the other 38%; for the
  rest, Feeling and Time and Season are the only handles.
- **Translation provenance** is unknown (section 1): a flawed translation produces a flawed label.
- **Lexicon bias.** I chose the seed words. Editors can add or strike words in `song_taxonomy_v0.json` without code.
- **Old mood chips** are keyword-built too; two systems with one name confuse people.
- **Dialect songs** are hidden in the app today; a language tag may re-surface them. Decide deliberately.

## 9. Top decisions for Dada

1. **Two-layer model with a visible "Suggested" label?** Recommendation: yes. Curated stays on top and authoritative;
   auto labels appear after it, tagged, and only after the review gate.
2. **Which facets to show?** Recommendation: Feeling (7), Time of day (4) and Season (5) as shelves; Subject (8)
   inside "All collections"; Imagery search-only; never show the default "Devotion and the Beloved" as a shelf.
3. **May the catalogue's own tags extend the curated lists now?** The `(Krsna)` and `(Shiva)` tags give 97 and 31
   songs against 15 and 15 curated. Recommendation: yes, labelled "from the catalogue", after Dada confirms the
   tags mean what the collections mean. Also: what do plain `K` and `D` stand for? I will not guess.
4. **Who reviews, and what is the gate?** Recommendation: Dada or one editor does the 100-song spot check
   (about an hour) at an 85% pass mark; a second editor then works the weak values. No value goes live below 85%.
5. **Final label wording.** Recommendation: the plain labels in section 2.3 (corpus words, Kiirtan with two i's,
   the app's own diacritics). Dada should rename any that sound wrong for the tradition, and decide whether
   "Strength and striving" and "Peace and stillness" stay or merge after review.
6. **Embeddings now or later?** They need a server key; I used none. Recommendation: later. Do the human review
   first; the reviewed labels become the test that tells us whether embeddings are worth the cost.

## 10. What this work could not do

- No embeddings and no use of the production FAISS index (needs a key).
- No Hindi or transliteration text (not in the file), no audio, no raga or tala.
- Festival and occasion cannot be derived from the meanings; only the curated lists exist.
- The hand check is 80 songs by one reader. It is a smoke test, not an accuracy measurement.
- The meanings of the `K` and `D` codes, and the provenance of the translations, are unknown.
- Nothing was shown in the app; no app file was touched.

Reproduce: `python3 data/proposals/audit_song_data.py`, `python3 data/proposals/classify_songs.py` (byte-identical output).
