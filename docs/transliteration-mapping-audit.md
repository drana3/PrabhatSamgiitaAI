# Transliteration mapping audit

- Ruleset version: `1.0.0`
- Engine version: `1.0.0`
- Total mappings: **62**

| Token | Devanagari | Rule ID | Source | Unambiguous | Kind | Test | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `A` | अ / (inherent) | V_A | spec | True | vowel | pass | short a / inherent vowel |
| `B` | ब | C_BA | spec | True | consonant | pass |  |
| `C` | च | C_CA | spec | True | consonant | pass |  |
| `D` | द | C_DA | spec | True | consonant | pass |  |
| `E` | ए / -े | V_E | spec | True | vowel | pass | e |
| `F` | फ़ | C_FA | spec | False | consonant | pass | foreign (fa) |
| `G` | ग | C_GA | spec | True | consonant | pass |  |
| `H` | ह | C_HA | spec | True | consonant | pass |  |
| `I` | इ / -ि | V_I | spec | True | vowel | pass | short i |
| `J` | ज | C_JA | spec | True | consonant | pass |  |
| `K` | क | C_KA | spec | True | consonant | pass |  |
| `L` | ल | C_LA | spec | True | consonant | pass |  |
| `M` | म | C_MA | spec | True | consonant | pass |  |
| `N` | न | C_NA | spec | True | consonant | pass |  |
| `O` | ओ / -ो | V_O | spec | True | vowel | pass | o |
| `P` | प | C_PA | spec | True | consonant | pass |  |
| `Q` | क़ | C_QA | spec | False | consonant | pass | foreign (qa) |
| `R` | र | C_RA | spec | True | consonant | pass |  |
| `S` | स | C_SA | spec | True | consonant | pass | dental sibilant |
| `T` | त | C_TA | spec | True | consonant | pass |  |
| `U` | उ / -ु | V_U | spec | True | vowel | pass | short u |
| `V` | व | C_VA | spec | True | consonant | pass |  |
| `W` | व | C_WA | spec | True | consonant | pass | non-tantric; pronunciation aid only |
| `Y` | य | C_YA | spec | True | consonant | pass |  |
| `Z` | ज़ | C_ZA | spec | False | consonant | pass | foreign (za) |
| `Á` | आ / -ा | V_AA | corpus | True | vowel | pass | long ā (a') |
| `Ñ` | ञ | C_NYA | corpus | True | consonant | pass | palatal nasal |
| `Ú` | ऊ / -ू | V_UU | corpus | True | vowel | pass | long ū (u') |
| `Ń` | ण | C_NNA | corpus | True | consonant | pass | retroflex ṇa |
| `Ŕ` | ड़ | C_RRA | corpus | True | consonant | pass | retroflex flap ṛ (r'/ŕ) |
| `Ś` | ष | C_SSA | corpus | True | consonant | pass | retroflex sibilant (s') |
| `Ḥ` | ः | M_VISARGA | spec | True | visarga | pass | visarga (ah) |
| `Ḿ` | ं | M_ANUSVARA | corpus | True | anusvara | pass | anusvara / nasalisation (m') |
| `Ṅ` | ङ | C_NGA | spec | True | consonant | pass | velar nasal (rare; usually anusvara) |
| `A'` | आ / -ा | V_AA_APOS | spec | True | vowel | pass | apostrophe form of ā |
| `AE` | ऐ / -ै | V_AE | spec | False | vowel | pass | diphthong ae; only short-a+e, long Á+E is ā+e not this token |
| `AO` | औ / -ौ | V_AO | spec | False | vowel | pass | diphthong ao; only short-a+o |
| `BH` | भ | C_BHA | spec | True | consonant | pass |  |
| `CH` | छ | C_CHA | spec | True | consonant | pass |  |
| `D'` | ड | C_DDA | spec | True | consonant | pass | apostrophe retroflex ḍa |
| `DH` | ध | C_DHA | spec | True | consonant | pass |  |
| `D́` | ड | C_DDA | corpus | True | consonant | pass | retroflex ḍa (D́) |
| `GH` | घ | C_GHA | spec | True | consonant | pass |  |
| `II` | ई / -ी | V_II | spec | True | vowel | pass | long ī (written 'ii') |
| `JH` | झ | C_JHA | spec | True | consonant | pass |  |
| `KH` | ख | C_KHA | spec | True | consonant | pass |  |
| `M'` | ं | M_ANUSVARA | spec | True | anusvara | pass | apostrophe anusvara |
| `N'` | ण | C_NNA | spec | True | consonant | pass | apostrophe retroflex ṇa |
| `PH` | फ | C_PHA | spec | True | consonant | pass |  |
| `R'` | ड़ | C_RRA | spec | True | consonant | pass | apostrophe retroflex flap |
| `S'` | ष | C_SSA | spec | True | consonant | pass | apostrophe retroflex sibilant |
| `SH` | श | C_SHA | spec | True | consonant | pass | palatal sibilant |
| `T'` | ट | C_TTA | spec | True | consonant | pass | apostrophe retroflex ṭa |
| `TH` | थ | C_THA | spec | True | consonant | pass |  |
| `T́` | ट | C_TTA | corpus | True | consonant | pass | retroflex ṭa (T́) |
| `U'` | ऊ / -ू | V_UU_APOS | spec | True | vowel | pass | apostrophe form of ū |
| `ŔH` | ढ़ | C_RRHA | corpus | True | consonant | pass | retroflex flap aspirate ṛh |
| `D'H` | ढ | C_DDHA | spec | True | consonant | pass | apostrophe retroflex ḍha |
| `D́H` | ढ | C_DDHA | corpus | True | consonant | pass | retroflex ḍha (D́h) |
| `R'H` | ढ़ | C_RRHA | spec | True | consonant | pass | apostrophe retroflex flap aspirate |
| `T'H` | ठ | C_TTHA | spec | True | consonant | pass | apostrophe retroflex ṭha |
| `T́H` | ठ | C_TTHA | corpus | True | consonant | pass | retroflex ṭha (T́h) |
