# YouTube recheck (local pass, no network)

Date: 2026-11-05. Script: `python -m scripts.recheck_youtube_local --write`.

The pass re-judges the bundled `data/generated/youtube_videos.json` with the stricter
rules now in `scripts/sync_youtube.py` (`verification_problems`):

1. the number is a plausible song number: 1..5018, not a year (1900-2099 without a
   marker such as `#`, `No.`, `PS`), not a date, a length or a part number;
2. the title is not a dance, compilation, interview, live, Kiirtan or Mahamantra
   programme (unless the channel or video is flagged `allow_programme` / `programme_ok`);
3. the song title, first line or opening lyric lines agree with the video title
   (fuzzy, accents and spelling folded, at least 0.75).

Only downgrades happen: a failing entry goes from `verified` to `needs_review` and stays in
the file with `metadata_json.needs_review_reasons`. Nothing is upgraded, deleted or relinked.
The review queue file is not changed (queue statuses stay `pending_review`).

## Numbers

- bundled videos checked: 813
- downgraded to needs_review: 13
- reasons: programme_title 12, title_mismatch 1
- review queue items judged: 117
- ambiguous pairs listed in the audit: 26 pairs (26 videos);
  the audit's summary row says 28, but only these pairs are named

## Downgraded videos

| Song | Video | Title | Reasons |
|---|---|---|---|
| 1565 | MiFAhap5qAM | Vajra Kathora Kusuma Koraka \| Prabhat Samgiita #1565 \| Dance by Prama Dev Jaipur | programme_title:dance |
| 1565 | eXXUy_azHnk | DMS Mumbai 2018 RAWA Programme Dance in Prabhat Samgiita No. 1565 VAJRA KAT́HORA KUSUMA KORAKA | programme_title:programme |
| 2315 | SRLQB9fmZ9c | Tomar Bhalobasha - Prabhat Sangeet #2315 | title_mismatch |
| 2505 | 2y2_cJ9maUo | DMS Mumbai 2018 RAWA Programme Dance in Prabhat Samgiita No. 2505. "Jay Shiva Shvambhu Pashupate" | programme_title:programme |
| 3028 | -n2to5qns64 | DMS Mumbai RAWA Programme prabhat samgiita No. 3028 (priya aamar bandhu aamar) 2018 | programme_title:programme |
| 3388 | qcm74ggFWFc | DMS Mumbai Rawa Programme Dance in prabhat samgiita No. 3388 (Tumi Esecho adhuri Jhariyecho) | programme_title:programme |
| 3614 | bHioat12_GM | DMS Mumbai RAWA Programme prabhat samgiita No. 3614( ( Tomar Egan Aanadikaler anand temeshe) | programme_title:programme |
| 3744 | 5lagTMlyWhk | Shiva Song - Ambara Majhe - Prabhat Samgiita Based Dance RAWA Mumbai #3744 | programme_title:dance |
| 3744 | Zh_jmS-pIy4 | AMBARA MA'JHE D'AMBARU BA'JE Prabhat samgiita (P.S No. 3744) Dance | programme_title:dance |
| 3881 | gWlmHFJKre0 | DMS Mumbai RAWA Programme Dance in Prabhat samgiita No.3881 ( CEONÁ, CEONÁ, CEONÁ ÁMÁR PÁNE ) | programme_title:programme |
| 4070 | DN3et6RRUdk | Krishna Song - Prabhat Samgiita - Tum Ho Mere Krishna #4070 \| Dance By Prama Dev Jaipur | programme_title:dance |
| 4370 | 37oWW8gAABk | DMS Mumbai 2018 RAWA Programme Dance in Prabhat Samgiita No. 4370 TOMÁR NÁMER TARI BEYE | programme_title:programme |
| 4425 | LH6zZo-Nyms | DMS Mumbai Rawa Programme Dance in Prabhat Samgiita No. 4425 ( VRINDÁVANAM PARITYÁJYA ) | programme_title:programme |

Each of these needs a person to listen/watch and either restore `verified` or unlink.

## Ambiguous pairs (short title fits two songs)

`own` is the agreement of the video title with the linked song, `other` with the second
song of the pair. The number in the title decides, so a pair stays verified when the title
carries the linked number and agrees with its song.

| Pair | Title | own | other | Number in title | Same song title | Status now |
|---|---|---|---|---|---|---|
| 116/3790 | Varasha Eseche - Prabhat Sangeet #116 | 1.0 | 1.0 | 116 | no | verified |
| 152/2506 | Champaka Vane - Prabhat Sangeet #152 | 1.0 | 1.0 | 152 | no | verified |
| 1272/4738 | Amar Gopan Katha - Prabhat Sangeet song #1272 | 1.0 | 1.0 | 1272 | no | verified |
| 1391/3334 | Tomar Katha Bheve - Prabhat Sangeet song #1391 | 1.0 | 1.0 | 1391 | no | verified |
| 3476/1442 | Amar e phulvane - Prabhat Sangeet #3476 | 1.0 | 1.0 | 3476 | no | verified |
| 3201/1481 | Tomare Ceyechi Ami - Prabhat Sangeet #3201 | 1.0 | 1.0 | 3201 | no | verified |
| 3299/4395 | Tomare Ceyechi - Prabhat Sangeet song #3299 - Singer - Jayatika Samanta | 1.0 | 1.0 | 3299 | no | verified |
| 1228/3264 | Tomar Amar Majhe - Prabhat Sangeet song #1228 | 1.0 | 1.0 | 1228 | no | verified |
| 2586/1064 | Mor Nayane - Prabhat Sangeet song #2586 - Singer - Sourabh Das | 1.0 | 1.0 | 2586 | no | verified |
| 2850/2596 | Alor Pare Alo - Prabhat Sangeet song #2850 - Singer - Smritikana Das | 1.0 | 1.0 | 2850 | no | verified |
| 3261/4000 | Bengali Song - Priyatama Tumi Mor - Prabhat Sangeet #3261 | 1.0 | 0.696 | 3261 | no | verified |
| 2137/2750 | Kon Se Atite - Bengali Prabhat Sangeet #2137 | 1.0 | 1.0 | 2137 | no | verified |
| 2732/4287 | Nabhah Niilimay - Prabhat Sangeet song #2732 - Singer - Subhankar Halder | 1.0 | 1.0 | 2732 | no | verified |
| 2797/1692 | Alor Dhara Elo - Prabhat Sangeet song #2797 - Singer - Subhra Bhowmik | 1.0 | 1.0 | 2797 | no | verified |
| 2741/1841 | Bhevechile Bhule Gechi - Prabhat Sangeet #2741 | 0.8 | 0.875 | 2741 | no | verified |
| 3850/3841 | Krishna Song - Eso Mor Madhu Vrindavane - Prabhat Sangeet #3850 | 1.0 | 0.905 | 3850 | no | verified |
| 4678/3601 | Arupa Ratan - Prabhat Sangeet song #4678 - Singer - Priyashivananda | 1.0 | 1.0 | 4678 | no | verified |
| 2648/1371 | Alakha Nirainjana - Prabhat Sangeet song #2648 - Singer - Sunanda Paul | 0.933 | 1.0 | 2648 | no | verified |
| 2603/2560 | Utala Pavane - Prabhat Sangeet song #2603 - Singer Surobhi Dibhar | 1.0 | 1.0 | 2603 | no | verified |
| 579/2668 | Prabhat Samgiita - Jeona Jeona - Shrii Shrii Anandamurti #579 | 1.0 | 1.0 | 579 | no | verified |
| 1395/3324 | Tumi Je Amar - Prabhat Sangeet song #1395 | 1.0 | 1.0 | 1395 | no | verified |
| 3209/3324 | Tumi Je Amar - Prabhat Sangeet song #3209 - Singer - Dhrubajyoti Sinha | 1.0 | 1.0 | 3209 | no | verified |
| 4595/1932 | Shiva Song - Anek Diner Pare - Prabhat Sangeet #4595 | 1.0 | 1.0 | 4595 | no | verified |
| 2712/4118 | Mamata Makha - Prabhat Sangeet song #2712 - Singer - Shilpi Shit | 1.0 | 1.0 | 2712 | no | verified |
| 1406/1594 | Bakula Taru Chaye - Prabhat Sangeet song #1406 | 0.963 | 0.929 | 1406 | no | verified |
| 2579/2876 | Niil Akashe - Prabhat Sangeet song #2579 - Singer - Jayashree Saha | 1.0 | 1.0 | 2579 | no | verified |

## Review queue (117 pending items, statuses unchanged)

Verdict by the new rules. 'would verify' means the rules alone would not stop an approval;
nobody approves queue items automatically any more (`persist_youtube_inventory` approves
a queue entry only for a video that was actually linked as verified).

| Video | Channel | Title | Number | Verdict | Reasons | Already a bundled video of |
|---|---|---|---|---|---|---|
| -_Dm1DMI4UU | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| AC' PRIYASHIVANANDA AVADHUTA \|\| TUMI RUPE BHUBAN \|\| |  | no usable song number | missing_explicit_song_number |  |
| -bdBP6feP24 | ANANDA MARGA | ✨ Prabháta Saḿgiita Divas 2025 Highlights \| Songs of the New Dawn 🌸🎶 \| Ananda Marga Delhi |  | no usable song number | missing_explicit_song_number |  |
| -qPQfuvMqSo | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| RONGIN PORI BOLE JAYE \|\| SATYASANDHA HAZARIKA \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| 3flPOpE8PI4 | ANANDA MARGA | DMS Ananda Nagar 1st Jan. 2019 Prabhat Samgiita "Tumi Chand Aami Chakor" Sing By Gouri Vishwas. |  | no usable song number | missing_explicit_song_number |  |
| 48U68i8JURQ | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| DIPABOLI  SAJAYECHI PROBHU \|\| ARUNDHATI BEZBARUAH \|\| #diwalispecial \|\| |  | no usable song number | missing_explicit_song_number |  |
| 49ST5qoNJhE | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| SAKAL MONER BINA \|\| SUSHMITA SINGH \|\| #prabhatsamgiit #chandanasharma |  | no usable song number | missing_explicit_song_number |  |
| 5zf9p6IpzRI | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| AHA KI SUNILAM \|\| SHREERADHA BANDOPADHAY \|\| #prabhatsamgiit #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| 6qwnvyHpi_w | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| MONERI GOBHIRE CHUPI SARE \|\| SRESHTHA HALDAR \|\| #rawaassam #song |  | no usable song number | missing_explicit_song_number |  |
| 7zxMQx_wIfI | ANANDA MARGA | MAGAH GELI MITHILÁ GELI  #4513 मगह गेलि मिथिला गेलि  \|\| प्रभात संगीत - Prabháta Saḿgiita | 4513 | would verify |  | 4513 |
| 8-Tnp-hu4qE | ANANDA MARGA | ✨ Prabháta Saḿgiita Divas 2025 \| Gorakhpur Celebration 🌸 \| Children’s Mystical Dance  Part 2🎶 |  | no usable song number | missing_explicit_song_number |  |
| 9plH0uETKd0 | ANANDA MARGA | PRABHÁTA SAḾGIITA \| Tum Ho Mere Krishna Jagatpati \| By Svechchha Sahu -Golden Book of World Records |  | no usable song number | missing_explicit_song_number |  |
| AQY-fwwixiE | ANANDA MARGA | RAWA Mumbai Presents “Jadu Nagaria Se” \| Classical Folk Dance on Prabhat Samgiita |  | no usable song number | missing_explicit_song_number |  |
| AotRAs9Pipw | ANANDA MARGA | Art Meets Spirituality ✨ Prabhat Samgiita Dance \| Classical Folk Presentation \| RAWA Mumbai 2026 |  | no usable song number | missing_explicit_song_number |  |
| BKE-rq7kPaE | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| AMI GOLAPER BUKE \|\| SRIJAN PORAIL \|\| #rawaassam #srijanporail |  | no usable song number | missing_explicit_song_number |  |
| Be9Qt8g9xYk | ANANDA MARGA | ✨ Prabháta Saḿgiita Divas 2025 \| Children’s Dance Performance \| Gorakhpur UP 🌸🎶 |  | no usable song number | missing_explicit_song_number |  |
| CUwVtqO7cr4 | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| AMAR GRAME \|\| ARUNDHATI BEZBARUAH \|\| #prabhatsamgiit #arundhatibezbaruah |  | no usable song number | missing_explicit_song_number |  |
| G008MctRFDs | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| DANCE \|\|TUMI RUPE BHUBAN \|\| SIMRAN & PRIYANKA \|\| GARBA STYLE \|\| #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| Gp4pzqsbkgg | ANANDA MARGA | DMS Jamalpur 2019 \| Prabhat Samgiita No. #TUMI, ESO GO ESO GO ESO GO |  | no usable song number | missing_explicit_song_number |  |
| HQKGd2FywVk | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| NECHE NECHE BHESE ASE \|\| AC' TATTVAVEDANANDA AVADHUT \|\| #rawaassam #coversong |  | no usable song number | missing_explicit_song_number |  |
| Hg0R_Xk2MM0 | MANAS RAWA ASSAM | PRABHAT SAMGIIT BY CHANDANA SHARMA _ JIBONE MORONE |  | no usable song number | missing_explicit_song_number |  |
| Hxcj2XOZ27s | ANANDA MARGA | Prabhat Samgiita Divas 2025 \| Gorakhpur \| Avtk. Ananda Kalyanmaya Ac. Sharing the Essence |  | no usable song number | missing_explicit_song_number |  |
| IuqXfEAK8w4 | ANANDA MARGA | Prasenting By RAWA Singing of Prabhat Samgiita "MALIK HO MERE" By Shrikant. |  | no usable song number | missing_explicit_song_number |  |
| J7Ja2rr-mVE | ANANDA MARGA | DMS Mumbai 2018 Prabhat Samgiita No. 0193 Andhar Sagare Peth Hariye singing By Shubhchintananda dada | 193 | would verify |  |  |
| JeYnPrqLP3g | ANANDA MARGA | RAWA Cultural Evening \|\| Dance on Prabhat Samgiita - Krishnosti Purushotama \|\| Spiritual Festival |  | no usable song number | missing_explicit_song_number |  |
| Jr2QSWTngf4 | ANANDA MARGA | DMS Jamalpur 30 March D.C. \| P.S. #4521 TUMI, ÁMÁR PRIYA SABÁR PRIYA |  | no usable song number | missing_explicit_song_number |  |
| K4EI1bSA5l0 | ANANDA MARGA | Prabhát Saḿgiita PS 4165 "Karatár Hamáre" \| Ananda Purnima DMS 2025, Ananda Nagar | 4165 | would verify |  | 4165 |
| KB1IGrSfdTY | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| JIBONE MORONE \|\| DOLL NATH \|\| #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| KqHHEov2QaE | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| TUMI KON ATITE MORE \|\| MANAS \|\| #rawaassam #prabhatsamgiit #atit |  | no usable song number | missing_explicit_song_number |  |
| Kza2Na0cSPU | ANANDA MARGA | DMS Ananda Nagar 1st Jan. 2019 P.S. No. #0669 PRABHU HE MAMA TUMHARI voice Ac' Jagdatmananda Avt. |  | no usable song number | missing_explicit_song_number |  |
| LD_q-vU-pOQ | MANAS RAWA ASSAM | PRABHAT SAMGIITA II AMAR KANU \|\| DANCE DRAMA \|\| BY TEAM RAWA ASSAM \|\| #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| LdbBE44HB0k | MANAS RAWA ASSAM | AN INTERVIEW \|\| PRABHAT SAMGIITA \|\| JHANKRITA SARKAR \|\| #rawaassam #prabhatsamgiitpodcast |  | no usable song number | missing_explicit_song_number |  |
| LhkzOOADXJc | MANAS RAWA ASSAM | AN INTERVIEW \|\| PRABHAT SAMGIITA \|\| ARUNIMA BHATTACHARJEE #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| LlF39AtzOOQ | ANANDA MARGA | Jaya Shubha Vajradhara \| Shiva Song \| Prabhat Samgiita 2526 \| By Acarya Jagadatmananda Avt. | 2526 | would verify |  |  |
| M8nHCN7uXJk | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| JAAR AR KEO NAI \|\| SRESHTHA HALDAR #rawaassam #prabhatsamgiit #sreshtha |  | no usable song number | missing_explicit_song_number |  |
| MNZUJ_cFkfw | ANANDA MARGA | RAOSHANII SE ÁYE HO TUM \|\| रौशनी से आये हो तुम #4135 Prabhata Samgiita \|\| प्रभात संगीत | 4135 | would verify |  | 4135 |
| MZDhu6jmlSo | ANANDA MARGA | DMS Jamalpur 2019 \| 30 March Evening  P.S No. #4098 TORE VÁSTE HAMAR PRABHU KATTE YUGA BITI CUKALAE |  | no usable song number | missing_explicit_song_number |  |
| MlKHhrmRKR8 | MANAS RAWA ASSAM | BIDISHA BEZBARUAH ANCHORING PRABHAT SAMGIIT PROGRAM |  | no usable song number | missing_explicit_song_number |  |
| NCQC86cpW9o | ANANDA MARGA | ANNUAL FUNCTION \|\| PRABHA'T  SAM'GIITA"FAUJ TUMHARI BIGUL BAJAO" \|\| Ananda Marga School, Varanasi. |  | no usable song number | missing_explicit_song_number |  |
| NYoXQyZTqB8 | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| KENO KRISHNO SAJAL TITHITE  \|\| DANCE \|\| RIMJHIM DEV #prabhatsamgiit #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| NaR2Af22nYY | MANAS RAWA ASSAM | AN INTERVIEW WITH PRABHAT SAMGIITA \|\| GARGI DAS BAKSHI  \|\| LIVE #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| NazdUOZf4Dg | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| MANANE ESO PRIYO MOR \|\| TANISHKA SARKAR #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| Nbd0Ev2wLdg | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| JAYA SHIVA SWAMBHO \|\| MANAS \|\| #rawaassam #shivasong |  | no usable song number | missing_explicit_song_number |  |
| P-AFHOA96cI | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| SUSHMITA GOSWAMI \|\| #prabhatsamgiit #rawaassam #collection |  | no usable song number | missing_explicit_song_number |  |
| PCVCIeE3a3Y | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| JE POTH DIYE ESECHILUM \|\| MANAS #rawaassam #prabhatsamgiit #spiritualjourney |  | no usable song number | missing_explicit_song_number |  |
| Prz-dG2lKWw | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| ACHO ASHRU DHARA \|\| NRITYANGANA NARTHAKI \|\| #rawaassam #dance |  | no usable song number | missing_explicit_song_number |  |
| Qfgi7xGA3zs | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| TUMI KARUNAMOYE \|\| CHANCHARIKA BISWAS \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| R2ShX41lz9U | AMPS Spirituality | Shiva Song - Tandav Nache Metecha #3282 |  | no usable song number | missing_explicit_song_number |  |
| SCoOAgY6p6E | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| NAYANERI ANJANA \|\| SATYASANDHA HAZARIKA \|\| #prabhatsamgiit #satyasandhahazarika |  | no usable song number | missing_explicit_song_number |  |
| SEyi9hQW9lU | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| TUMI BHULONA MORE \|\| ADITYA DAS GUPTA \|\| #prabhatsamgiit #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| SZQbDWi80g8 | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| SAKAL MONER BINA \|\| MARCUS ANDY JEAN PIERRE (ABHAY )  #prabhatsamgiit #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| TN1SNxK6t3w | ANANDA MARGA | DMS Jamalpur 2019 \| P.S. No. #3382 "SE DIN SANDHYÁY SMITA VASUDHÁY" \| Voice : Ac' Arupananda Avt. |  | no usable song number | missing_explicit_song_number |  |
| U3knCJoHDag | ANANDA MARGA | Prabhata Samgiita #1412 PRIYA TAMA PABHU AMAR Referred by Rev.  Purodha Pramukh dadaji. | 1412 | would verify |  | 1412 |
| UYSZt33M-vc | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| ASIBE BOLIYA GIYACHE CHOLIYA \|\| BIUSH BHAWAL \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| V6-x-73bL8M | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| KAHAKEO PAPI BHEBE \|\| ARUNDHATI BEZBARUAH #rawaassam #devotion #spirituality |  | no usable song number | missing_explicit_song_number |  |
| Vzdd3GyGejs | MANAS RAWA ASSAM | PRABHAT SAMGIITA \| NACHER TALE AGIYE CHOLE \| DANCE \|  RIMJHIM DEV \| #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| WR0WZOanhe4 | ANANDA MARGA | Kripa Karo Prabhu Kripa Karo Prabhata Samgiita Referrred by Revered Purodha Pramukh dadaji. |  | no usable song number | missing_explicit_song_number |  |
| Xrd1rkGXsQM | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| TUMI PRANER POROSHE \|\| SAMAETA MANDAL \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| Y5dvvikXulU | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| TOMAYE AMI PELUM \|\| ANANTA VIJAYA \|\| BALI INDONESIA #rawaassam ##prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| Y7Lud8O9loA | ANANDA MARGA | Welcome Song ✨ Prabhat Samgiita Dance \| RAWA Mumbai Cultural Evening 2026 |  | no usable song number | missing_explicit_song_number |  |
| Y_rPiPUw35Q | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| VIHAAN KALE TALE TALE \|\| ARUNDHATI BEZBARUAH \|\| #prabhatsamgiit #folksong |  | no usable song number | missing_explicit_song_number |  |
| ZVq4uk5FAQw | MANAS RAWA ASSAM | PRABHAT SAMGIIT DAY SPECIAL \|\| NUTONER GAAN NIYE ESECHO \|\| MANAS #rawaassam #prabhatsamgiitday |  | no usable song number | missing_explicit_song_number |  |
| _S_OiFg1jNY | ANANDA MARGA | DMS Jamalpur RAWA Programme Dance P.S. No. #4061 Tomare Kache Peye By Bhopal Rawa. |  | no usable song number | missing_explicit_song_number |  |
| _dFdt697M5U | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| TUMI ESO AMAR GHORE \|\| SUNANDA CHOUDHURY \|\| #prabhatsamgiit #rawaassam #dance |  | no usable song number | missing_explicit_song_number |  |
| _qeN6G1hhio | MANAS RAWA ASSAM | PRABHAT SAMGIIT BY SHREYA GHOSHAL _ TUMI AMAR DHYAN |  | no usable song number | missing_explicit_song_number |  |
| aYPk-270Hao | ANANDA MARGA | DMS Ananda Nagar 1st Jan. 2019 Prabhat Samgiita No.0130 "Shonali Bhor Jiivane mor" | 130 | would verify |  |  |
| bFIXTfkKiwg | ANANDA MARGA | Ananda Purnima DMS 31st May 2019 Morning DC P.S. #3999 "RÚPER DEUL MÁJHE ARÚPA RATAN KHUNJI" |  | no usable song number | missing_explicit_song_number |  |
| cVuWXtlaHxQ | ANANDA MARGA | DMS Ananda Nagar 1st Jan. 2019 P.S. No. #4166 MUSÁFIR ÁGE BAŔHATE voice Ac' Jagdatmananda Avt. |  | no usable song number | missing_explicit_song_number |  |
| cpI-60p4iis | MANAS RAWA ASSAM | AN INTERVIEW \|\| PRABHAT SAMGIITA \|\| ACHYUT BEHRA \|\| #rawaassam #interview ##prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| dFRl9urvPuI | ANANDA MARGA | Blissful Avarta Kiirtan \| Baba Nam Kevalam \| Prabhat Samgiita Based Tune \| Bhakti Live from Jamalpur |  | no usable song number | missing_explicit_song_number |  |
| dyh6P3oTQ8s | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| BIJONE BOSHE BHABI DUBELAYE \|\| ARUNDHATI BEZBARUAH #folksong #rawaassam #mp3 |  | no usable song number | missing_explicit_song_number |  |
| f3afpDMsN9g | ANANDA MARGA | RAWA Dance on P.S. #1187 TOMARI PRIITITE GARA. |  | no usable song number | missing_explicit_song_number |  |
| fHW5CV4b_78 | MANAS RAWA ASSAM | PRABHAT SAMGIIT (DANCE) BY KRISHNA RANI DEKA _ TUM HO MERE KRISHNA |  | no usable song number | missing_explicit_song_number |  |
| fRiuvZKHoCA | ANANDA MARGA | Baba Nam Kevalam Kiirtan \| Siddha Mahamantra in 8 Prabhat Samgiita Tunes \| 25 Mins Meditation Music |  | no usable song number | missing_explicit_song_number |  |
| fXHq59mvxvk | ANANDA MARGA | RAWA Cultural Evening \|\| Prabhat Samgiita Jaya Shubha Vajra Dhara \|\| Vidushi Kalaivani VANI RAJMOHAN |  | no usable song number | missing_explicit_song_number |  |
| fipYfr2O0fY | MANAS RAWA ASSAM | PRABHAT SAMGIIT (DANCE) BY INDRANI MEDHI MORE SORAYE REKHONA DURE. |  | no usable song number | missing_explicit_song_number |  |
| hUOES6CnoaQ | ANANDA MARGA | RAWA Cultural Evening \|\| Vajra Kathor Prabhat Samgiita \|\| Dance Perform  by Anamika from Varanasi |  | no usable song number | missing_explicit_song_number |  |
| hdJUfqFhTZs | ANANDA MARGA | Prabhata Samgiita #25 DUNIYA WALON TAKTE RHO During New Year DMS Anandanagar 2022. | 25 | would verify |  | 25 |
| hvOBmYpP8fA | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| TUMI AMAR PRIYO SOBAR PRIYO \|\| CHANDANA SHARMA \|\| #prabhatsamgiit #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| iQ6RAgmal9A | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\|  TVAM MAMA PRIYA \|\|  MANAS \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| ipm_kSflV2Q | ANANDA MARGA | Prabháta Saḿgiita Celebration 2024 \|\| Glimpses from Across Delhi Sector |  | no usable song number | missing_explicit_song_number |  |
| iruH8zE7NQA | ANANDA MARGA | Prabháta Saḿgiita 4579 \| Tumi Káche Thekeo Dúre Go \| Ananda Purnima DMS 2026 \| Ananda Nagar | 4579 | would verify |  | 4579 |
| jcHvuy4iR_0 | MANAS RAWA ASSAM | AN INTERVIEW WITH PRABHAT SAMGIIT  \|\| NUTAN SEN  \|\| LIVE #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| kVT4zEkNrrI | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| DUNIYA WALO TAKTE RAHO \|\| MANAS \|\| #prabhatsamgiit #qawali #urdu |  | no usable song number | missing_explicit_song_number |  |
| kWuLd2KnloQ | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| AMAR E PHULOBONE SONGOPONE \|\| MANAS \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| lKheGyLCOkY | ANANDA MARGA | Jaya Shiva Svayambho Pashupate \|\| Prabhata Samgiita in Educational Conference (Balrampur). |  | no usable song number | missing_explicit_song_number |  |
| lUnv90dQBu4 | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| VAJRA KATHORA \|\| KANKANA BHATTACHARYA & GROUP \|\| #dance #kankanabhattacharya |  | no usable song number | missing_explicit_song_number |  |
| leduJMds6Vg | ANANDA MARGA | Prabhat Samgiita #0712 MANERA MAJHE KHUNJI During New Year DMS 2022. | 712 | would verify |  |  |
| lfst3vLzORU | ANANDA MARGA | DMS Ananda Nagar 1st Jan. 2019 P.S. No. #0670 PHULER VANE BHOMORÁ ELO voice Ac' Jagdatmananda Avt. |  | no usable song number | missing_explicit_song_number |  |
| mhfHFQtqhfw | ANANDA MARGA | RAWA Cultural Evening \|\| Prabhat Samgiita - Jaya Shiva Svayambho \|\| ROHINI KANDALA from Hyderabad |  | no usable song number | missing_explicit_song_number |  |
| nN7xFsHFw4M | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| BENU BONE NUPURO PAYE \|\| PARISHMITA DEKA \|\| #prabhatsamgiit #dance #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| oHTvhOVswmc | MANAS RAWA ASSAM | PRABHAT SAMGIITA BY SRIKUMAR CHATTOPADHYAY #prabhatsamgiit #srikumarchattopadhyay |  | no usable song number | missing_explicit_song_number |  |
| oLvvujYorMk | AMPS Spirituality | Krishna Song - Goloker Hari #4677 |  | no usable song number | missing_explicit_song_number |  |
| oVdsuCl-uhY | MANAS RAWA ASSAM | PRABHAT SAMGIIT (DANCE) _ TUMI JE ESECHO AJ BATHITO JONER KOTHA BHABITE |  | no usable song number | missing_explicit_song_number |  |
| p_uoHLdEEWA | MANAS RAWA ASSAM | AN INTERVIEW WITH PRABHAT SAMGIITA \|\| BANANI DEBNATH \|\| #rawaassam #prabhatsamgiitpodcast |  | no usable song number | missing_explicit_song_number |  |
| pa1xUwJQYu0 | MANAS RAWA ASSAM | AN INTERVIEW \|\| PRABHAT SAMGIITA \|\| SATYAJIT JAIN #rawaassam #prabhatsamgiitpodcast |  | no usable song number | missing_explicit_song_number |  |
| paB_lniQVK4 | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| AKSHAY TUMI ABBAYI TUMI \|\| BIUSH BHAWAL \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| pnwmwJC1J6o | ANANDA MARGA | 44th Prabhát Saḿgiita Divas 2026 \| संदेश एवं आशीर्वचन by Revered Purodha Pramukh 🙏🎶 |  | no usable song number | missing_explicit_song_number |  |
| qBetVshvIGY | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| TOMAR OPAR DANE \|\| MANAS \|\| MP3 #rawaassam |  | no usable song number | missing_explicit_song_number |  |
| r8BAzc-eQd0 | ANANDA MARGA | DMS Jamalpur 2019 \| P.S. Referred By P.P. Dada \| #3862 TUMI, LIILÁ KARE JÁO KII KÁRAŃE |  | no usable song number | missing_explicit_song_number |  |
| s_0wK94LRdk | ANANDA MARGA | Prabháta Saḿgiita "Tomay Ami Bhalobashi" \| RAWA Cultural Program \| New Year's DMS 2026 #krishnasong |  | no usable song number | missing_explicit_song_number |  |
| tfWuvGBxr0g | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| TUMI ESECHILE KAUKE NA BOLE \|\| ARUNDHATI BEZBARUAH \|\| #mahaprayanspecial |  | no usable song number | missing_explicit_song_number |  |
| tgHyij4WwaM | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| MORA KAAJ NIYE \|\| SANAT BARUA TEAM \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| twyvn4myad4 | ANANDA MARGA | RAWA Cultural Evening \|\| Jadu Nagariya Se Prabhat Samgiita \|\| Spiritual Festival Delhi |  | no usable song number | missing_explicit_song_number |  |
| ujOWWcAyCGQ | MANAS RAWA ASSAM | PRABHAT SAMGIIT // TUMI CHAND AMI CHOKOR // SUBASMITA SARKAR |  | no usable song number | missing_explicit_song_number |  |
| uteeYHf6OUc | ANANDA MARGA | ✨Prabháta Saḿgiita ✨ Divas Celebration at Himatnagar 2024. |  | no usable song number | missing_explicit_song_number |  |
| uzxU28I2Aqs | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| NACHER TALE EGIYE CHOLE \|\| ARUNDHATI BEZBARUAH #folksong #prabhatsamgiit #rawa |  | no usable song number | missing_explicit_song_number |  |
| v5N1_Vd1-dQ | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| BHAJARE ISTA NAM \|\| JAYANTA DAS \|\| #prabhatsamgiit #jayantadas |  | no usable song number | missing_explicit_song_number |  |
| vDOGZLvZMMM | ANANDA MARGA | DMS Mumbai 2018 RAWA Programme Singing in Prabhat Samgiita No. 0193 Andhar Sagare Peth Hariye | 193 | still needs a person | programme_title:programme |  |
| vUo3g8zudN0 | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| VRINDAVANAM PARITYAJYA MP3 \|\| MANAS #rawaassam ##mp3 |  | no usable song number | missing_explicit_song_number |  |
| vawVWh-JlkI | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| JE AMAKE JAHAI BOLUK \|\| DANCE \|\|  PAROMITA DEY \|\| #rawaassam #dance |  | no usable song number | missing_explicit_song_number |  |
| wDNhW2uatzk | ANANDA MARGA | RAWA Cultural Evening \|\| Prabhat Samgiita - FAOJ TUMHÁRII BIGUL BAJÁO \|\|  Spiritual Festival |  | no usable song number | missing_explicit_song_number |  |
| wPE5RBQTo_c | ANANDA MARGA | Avadh Gye Prayag Gye \|\| Prabhata Samgiita in Educational Conference (Balrampur). |  | no usable song number | missing_explicit_song_number |  |
| whok89bC7LA | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| SUMUKHER PANE CHOLE JABO AMI \|\| SATYASANDHA HAZARIKA #rawaassam #prabhatsamgiita |  | no usable song number | missing_explicit_song_number |  |
| x836j3a5FWA | MANAS RAWA ASSAM | PRABHAT SAMGIITA \|\| VIHAN KALE TALE TALE \|\| ELORA BEZBARUAH \|\| #prabhatsangeet #folksong |  | no usable song number | missing_explicit_song_number |  |
| xh4mwIhM3ts | MANAS RAWA ASSAM | PRABHAT SAMGIIT \|\| PRABHU ESO TUMI \|\| AC' NITYASATTANANDA AVADHUT \|\| #rawaassam #prabhatsamgiit |  | no usable song number | missing_explicit_song_number |  |
| yhxsZKIt6I4 | ANANDA MARGA | DMS Jamalpur 2019 \| 31st March Morning P.S. No. #0678 "HRIDAY KAMALE SALAJE KOMALE" |  | no usable song number | missing_explicit_song_number |  |
| zRlQACMLFdA | ANANDA MARGA | HE PRABHU TUM ÁNAND MURAT HO \|\| ANANDA SAMGIITA. |  | no usable song number | missing_explicit_song_number |  |

Items the audit warned about:

- `Prabhata Samgiita Divas 2025` (4 items) and the Purodha Pramukh address with 2026: the
  year is no longer read as a song number (`missing_explicit_song_number`).
- `Siddha Mahamantra in 8 Prabhat Samgiita Tunes | 25 Mins` on 25: the 25 is a length, no
  longer read as a song number; the Kiirtan / Mahamantra words would block it anyway.
- interviews, podcasts, festival cuts: blocked by `programme_title:*` or by the missing number.

## Neon database (not touched by this pass)

The same videos exist as `media` rows with `verification_status = 'verified'` in Neon. The
API already hides everything that is not verified / verified_external / human_reviewed, but
the Neon rows still say `verified`. To make the database agree with the file, a person runs
the SQL below (review it first; it was NOT run):

```sql
UPDATE media
SET verification_status = 'needs_review'
WHERE provider = 'youtube'
  AND verification_status IN ('verified', 'verified_external')
  AND metadata_json->>'external_id' IN (
    'MiFAhap5qAM',
    'eXXUy_azHnk',
    'SRLQB9fmZ9c',
    '2y2_cJ9maUo',
    '-n2to5qns64',
    'qcm74ggFWFc',
    'bHioat12_GM',
    '5lagTMlyWhk',
    'Zh_jmS-pIy4',
    'gWlmHFJKre0',
    'DN3et6RRUdk',
    '37oWW8gAABk',
    'LH6zZo-Nyms'
  );
```
