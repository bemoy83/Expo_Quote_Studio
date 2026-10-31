# Foga System: byggesystemet bak standen

Alt som bygges i en stand er Foga System (Bjørn, 31.10.2026). **Flex** brukes til alt som ikke er tekstil
(vegger, takdrager, disker, dører). **Fabric** (TX-profiler) brukes til tekstilvegger, og standardprofilen er
**43TX**. Gulv, møbler, strøm og annen løsøre er ikke Foga og ligger utenfor Foga-motoren.

Kilde: *Foga System Designer's Guide* versjon 01.07 (PDF fra Bjørn, 80 sider). Nyere utgave:
<https://issuu.com/fogasystem/docs/designersguide_2024_ver01>. Artikkelnumre under er Fogas egne.

Koden for dette ligger i `src/foga/` (se nederst).

## 1. Grunnprinsippet: én kanal for alt

- Alle Flex-profiler har samme kanal: **9 mm åpning, 10 mm dyp**, i et **20 mm raster**. Profilene er 20,
  30, 40 eller 48 mm brede.
- Fordi kanalen er lik overalt, passer **alle koblinger i alle profiler**.
- De fleste profiler er «upright or rail»: samme profil kan være stolpe eller skinne.
- Arbeidshesten er **92** (20 × 40 mm, kanal på begge kortsider).

### Koblinger (skinne mot stolpe, hjørner, skjøter)

| Kode | Art.nr | Hva den gjør |
| --- | --- | --- |
| 615A | 871 055 92 | Standard. T-hode i kanalen klemmer skinne mot stolpe |
| 615B | 871 056 92 | Som 615A, skrue fra siden |
| 600 | 871 003 92 | Justerbart hode, skrue skjult i kanal eller på siden |
| 600QF | 871 062/063 92 | Verktøyfri (vri 90°). Lette rammer, lysbokser |
| 608B | 871 034 92 | Settes inn fra fronten. Rask montering, f.eks. dør mellom to stolper |
| 608BL / 608BR | 871 035/036 92 | 45°, til skråstag |
| 610 / 617 | 871 038 / 871 045 92 | 90° i kanalen, gjæret eller butt hjørne (617 er sterkere) |
| 613 | 871 043 92 | Flat plate for gjæret hjørne. **Hjørne for 01TX, 03TX, 43TX, 81TX** |
| 614 | 871 044 92 | Sterk intern kobling. **Hjørne for 92TX, 80TX** |
| 624 / 625 | 871 061 / 871 057 92 | Intern gjæring i plast (624 alle vinkler) |
| 604 | 871 031 92 | Forlenger i kanalen, brukes i par |
| 609 / 609QF | 871 037 / 871 050 92 | Forlenger inne i hulprofil |
| 606 | 871 032 92 | Kile som skjøter to stolper parallelt |
| 618 | 871 041 92 | Holder to parallelle profiler sammen |
| 540 | 871 540 92 | Skinne som møter siden av en annen (takgrid, avstivning) |

Hull for 600, 608 og 615B: Ø 10 mm, **28,6 mm fra profilenden**.

### Stolpeprofiler for hjørner og knutepunkt

| Profil | Mål (mm) | Bruk |
| --- | --- | --- |
| 92 | 20 × 40 | Rett stolpe eller skinne |
| 92B | 40 × 40 (flens) | 5 mm plater med magnet eller borrelås |
| 92L / 92R | 30 × 30 | 90° hjørne (R med hyllestøtte) |
| 92LL | 60 × 30 | Dobbelt 90° hjørne |
| 66 | Ø 40, 6 kanaler | Sekskant / flere retninger |
| 82 / 84 | 48 | 135° |
| 85 | 34 × 48 | 180° (T) |
| 88 | 48, 8 kanaler | Åttevei |
| 90 / 91 | 20 × 20 / 20 × 30 | Firkant, lette skinner |
| 292 / 293 / 294 | større | Kraftigere stolper (294 for store konstruksjoner) |

### Plater i Flex

- Plate står i kanalen: **platemål = synlig mål + 18 mm** i både bredde og høyde (9 mm inn i hver kanal).
- **Maks platetykkelse 9 mm.** Kanaladapter 301 tar plater opp til 37 mm, 114 tar 40 mm.
- Plastkanal 333 for 3–4 mm plater.

### Føtter

| Kode | Art.nr | Mål |
| --- | --- | --- |
| 730 | 876 730 92 | Fotplate 250 × 300 × 5 mm |
| 740 | 876 740 92 | Fotplate 400 × 400 × 5 mm |
| 750 | 876 750 93 | Fotplate 500 × 80 × 5 mm |
| 300B / 450B | 876 750 92 / 876 720 92 | Rund Ø 300 / Ø 450 mm |
| 720 | 876 720 22 | Fot eller hyllebrakett 20 × 10 × 300 mm |

### Ferdige Flex-enheter

- **Hel dør med karm:** 942 eller 950 × 2117 mm. Profil 292 og 101, koblinger 608B og 615B, hengsel 403,
  lås 410. Settes rett inn mellom to eksisterende stolper med 608B. Paneler 2 × 630 (638) × 907 mm.
- **Låsbare skyvedører:** 321, 322, 326, 320-20, lås 403/406. Panel H = åpning − 28 mm,
  B = (åpning + 21) / 2.

## 2. Tekstil (Fabric / TX)

Tekstilet har en silikonlist sydd i kanten (SEG), som trykkes ned i kanalen i profilen. Spenningen blir riktig
uten verktøy. Rammene settes sammen med **gjæringshjørner** og de samme Flex-koblingene.

| Profil | Art.nr | Tverrsnitt (mm) | Bruk |
| --- | --- | --- | --- |
| **43TX** | 873 805 22 | 40 × 40 | **Standard hos oss.** Dobbeltsidig, ekstra kanaler, veldig allsidig |
| 92TX | 873 808 22 | 40 × 40 | Dobbeltsidig |
| 03TX | 873 803 22 | 30 × 40 | Enkeltsidig |
| 01TX | 873 801 22 | 15,5 × 25,5 | Enkeltsidig, veggmontert |
| 02TX | 873 802 22 | 4 × 28 | Tynn list |
| 193TX | 873 818 22 | 20 × 65 | Flere kanaler |
| 60BTX | 873 813 22 | 60 × 65,5 | Dobbeltsidig, 60 mm dyp |
| 80TX | 873 810 22 | 80 bred | 80 mm mellom dukene, baklys |
| 41TX, 61TX, 81TX, 120TX, 150TX | 873 806/812/811/814/815 22 | 40–150 dyp | Lysbokser |
| 92LTX / 04TX | 873 809 / 873 804 22 | 57 × 40 / 20 × 44 | Usynlige hjørner mellom tekstilflater |

Tilbehør: hjørne 613 (43TX), vinkelkobling 625, koblingssett 20/40/80 (876 773/774/778 22: skrue + 505-mutter)
for å skru rammer sammen side om side, veggbrakett 520.

Lys: sidelys LED 10 W per 36 cm (67150), baklys 1,5 W / 20 cm (67210) eller 3,5 W / 52 cm (67215).
Strømforsyning 24 V 48 / 150 / 240 W (67158 / 67170 / 67156).

Bue: minste radius 600 mm for TX-profiler (81TX «hard way» 1500), 400 mm for Flex 90/91/92.

## 3. Regler motoren bygger på

Fra guiden (sikre):

1. **Tekstilramme = 2 × B + 2 × H profil**, kappet gjæret til yttermål. 4 hjørnekoblinger per ramme (613 for 43TX).
2. **Plate i Flex-felt = synlig + 18 mm**, maks 9 mm tykk.
3. **Dør = fast enhet** 942/950 × 2117 mm.
4. **Alle koblinger passer i alle Flex-profiler.**

Fra fabric.js / mockup «Produksjon» (fasit for tekstil, se `src/calc/fabric.ts`):

- B = spenn − sidefradrag (20) − luft (10); H = systemvegg 2490 + føtter 50 = 2540.
- Tverrstag når B > maks stagavstand (1000); staglengde = H − 2 × profil (40).
- Trykkfil = ramme + 2 × bleed.

### Åpne spørsmål (stilt Bjørn 31.10.2026)

Motoren gjetter ikke. Det som ikke er avklart har ingen oppskrift, og stykklisten viser det som et åpent punkt
i stedet for en del. Når et svar kommer, legges det inn i `src/foga/recipes.ts` og her.

1. **Stolpe** (40 × 40 i appen): hvilken profil? Hvilken i hjørne, T-kryss og fire-veis kryss?
2. **Topp- og bunnskinne** (960 × 40 / 960 × 30): hvilke profiler, hvilken kobling mot stolpen, hvor mange per ende?
3. **Veggplate** 960 × 2420: står den i kanalen (synlig + 18 mm)? Tykkelse?
4. **Føtter** (50 mm justerbare): hvilken del, hvor mange per stolpe?
5. **Takdrager** 80 × 20: hvilken profil, hvordan festes den til stolpen, er maks 6 m riktig?
6. **Tverrstag i 43TX-rammen**: profil og kobling? Feste av ramme til vegg? Koblingssett per skjøt mellom rammer?
7. **Dør og overstykke**: Fogas ferdige dør (292-karm)? Hva er overstykket bygget av?
8. **Plukkliste**: kappede lengder eller hele stenger fra lager? I så fall hvilke stanglengder?

## 4. Slik er koden delt

```
src/foga/
  parts.ts      Foga-deler som data: profiler, koblinger, tilbehør (art.nr, tverrsnitt)
  recipes.ts    Oppskrifter: hvordan tekstilramme, veggmodul, stolpe og takdrager bygges av deler.
                Bare bekreftede oppskrifter; resten er null og blir åpne punkter
  structure.ts  Nøytral beskrivelse av det som skal bygges (stolper, moduler, drager, rammer) i mm
  fromVariant.ts  Oversetter standskissen (Variant) til en Foga-struktur
  engine.ts     bom(struktur, oppskrifter) → stykkliste: kappliste per profil + koblinger og beslag
```

Motoren vet ingenting om gulv, møbler eller priser. Plukklisten setter sammen Foga-stykklisten og løsøre fra
kalkylen, delt etter produkt. Tilbudet bruker fortsatt kalkylen (`src/calc`) til priser.
