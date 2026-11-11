# Arbeidstegning: tegnspråk for plan, veggriss og tilbud

Låst av Bjørn 4.11.2026. Bestilling til implementering i appen. Begreper: [vegger.md](vegger.md), hvor koden ligger:
[kodekart.md](kodekart.md).

Designet er laget som mockup i Claude Design («Standskisse v5 · arbeidstegning»). Bildene i
[arbeidstegning/](arbeidstegning/) viser fasiten. Kildekoden til mockupen ligger i
[arbeidstegning/referanse/Tegning5.mockup.jsx.txt](arbeidstegning/referanse/Tegning5.mockup.jsx.txt) som oppslag for mål og
verdier. Den er skrevet mot mockupens egen kode (`PlanView` i en annen form, piksler i stedet for meter) og skal **ikke**
kopieres inn. Bygg det i appens lag og filer som beskrevet under.

| Bilde | Viser |
| --- | --- |
| [1-plan.png](arbeidstegning/1-plan.png) | Planen uten noe valgt: totalmål og plasseringsrad, tegnforklaring i gangfeltet |
| [2-valgt-standvegg.png](arbeidstegning/2-valgt-standvegg.png) | Valgt standvegg: modulkjeden erstatter plasseringsraden utenfor veggen |
| [3-veggriss.png](arbeidstegning/3-veggriss.png) | Veggrisset: modulkjede, plasseringsrad, høyder og hårfine henvisningslinjer |
| [4-tilbud.png](arbeidstegning/4-tilbud.png) | Tilbudet: 3D øverst, planen med fakta, Pos.-kolonne i prislisten |
| [5-tekstil-naert.png](arbeidstegning/5-tekstil-naert.png) | Tekstilvegg nært: blekkramme, appelsinfyll og tverrstreker |

## Formål

Selgeren tegner standen, og alt som er tegnet blir både tilbud og arbeidsordre. Planen er derfor en arbeidstegning,
ikke en illustrasjon: den skal leses av kunden på tilbudet og av montør og produksjon på arbeidsordren. 3D-visningen
selger, mens den tekniske tegningen er det partene blir enige om.

## Prinsipper

1. **Strek bærer konstruksjonen.** Systemvegg, stolper, dører og mål tegnes i blekk (`--ink`). Lagfargene
   (`LAYER_COLOR`, himmelblå vegg og fiolett tekstil) brukes ikke lenger i planen.
2. **Mønsteret sier hva det er. Tusjfargen løfter fram tilvalget.** Fargen tåler svart-hvitt-utskrift dårlig, så hvert
   tilvalg har også et mønster:

   | Produkt | Mønster | Tusjfarge |
   | --- | --- | --- |
   | Tekstilvegg (InFrame og frittstående) | tverrstreker, som spent stoff i ramme | appelsin `oklch(0.81 0.12 55)` |
   | Print og dekal på veggplate | rasterprikker | grønn `oklch(0.86 0.09 158)` |
   | Snekret vegg (finnes ikke i modellen ennå) | diagonal skravur 45° | ingen |

   Tusjfargene minner om de analoge markeringstusjene på gamle arbeidstegninger: oransje for tekstil, grønt for
   systemvegg med tilvalg. Blått var trevegg, men blått finnes allerede som RAL-farger. Snekret vegg får derfor
   skravur og ingen farge.
3. **Veggfarge tegnes på streken.** Platens RAL fyller kjernen i veggstreken. En hvit vegg og en blå vegg skilles
   uten notis.
4. **Gulvet er et lag.** Det er svakt synlig mens man tegner noe annet, og i full farge når gulvverktøyet er i hånden
   eller gulvgruppen er uthevet i kalkylen.
5. **Tall hører hjemme i dokumentene.** Posisjonsnummer vises på tilbudet (og i innstillingen «Vis posisjoner»), ikke
   på tegneflaten mens man tegner.
6. **Mindre i liten skala.** Under en terskel (se A4) faller detaljer bort: tverrstreker, modulkjeder og
   takdragerens kropp.

## Avklaringer før start

Svar fra Bjørn står i **fet**. Der det står «forslag», gjelder det til Bjørn sier noe annet.

- **A1 · Lagfargene.** `LAYER_COLOR` brukes også i kalkylepanelet (`CalcPanel.tsx`), veggskuffen, `DoorMap`,
  `DoorSettings`, `FreeTextileDrawer` og `Rail.tsx`. Forslag: legg tusjfargene som tokens i
  `styles/tokens/colors.css` (`--tusj-tekstil`, `--tusj-trykk`). Bruk tekstilfargen der `LAYER_COLOR.textile` brukes
  i dag, og blekk der `LAYER_COLOR.walls` og `.openings` brukes. Prikkene i kalkylepanelet følger dermed planen.
- **A2 · To nummerserier.** Produksjonen har allerede id-er per stykk: `T1`, `T2` … for tekstil og `F1` … for folie
  (`calc/production.ts`). De står i trykkfilnavn og på Tilbud (trykkfilene) og Arbeidsordre. Posisjonsnummer i v5 er noe annet:
  **ett nummer per artikkel**. Samme artikkel får samme nummer overalt, og nummeret står ved prislinjen. Forslag:
  behold `T`/`F` som de er (de er produksjonens nøkler), og innfør artikkelnummeret som `Pos.` bare på tilbudet. Om
  arbeidsordrens plan skal vise `Pos.` eller `T`/`F`, avgjør Bjørn. **Bjørn 7.11.2026: arbeidsordrens plan viser
  merkelappene tekstilene er merket med, `T1`, `T2` … på veggflate og `F1A`/`F1B` på hver side av en frittstående,
  så skissen viser hvilken duk som skal hvor. Tilbudet beholder `Pos.` Frittstående har ingen egen løpstekst
  («F1 · 2,5 m») i planen.**
- **A3 · Snekret vegg** har ingen modell, pris, 3D eller veggriss. Den er utenfor denne bestillingen. Reserver bare
  mønsteret (skravur, ingen farge) i `planStyle.ts`, så det ikke blir brukt til noe annet.
- **A4 · Liten skala.** Appen tegner i meter med faste strekbredder (`PLAN_WALL = 0.06`), så strekene vokser og krymper
  med visningen. Mockupen tegner hårstreker i skjermpiksler og bytter detaljnivå ved **55 px per meter**. Forslag:
  `PlanView` måler px per meter (ResizeObserver på svg-en) og gir lagene `u` (meter per skjermpiksel) og
  `detail: 'full' | 'compact'` (compact under 55 px/m) gjennom en kontekst. Miniplanen i 3D (`mini`) er alltid compact.
  Tilbudets plan blir compact av seg selv ved vanlig A4-bredde.
- **A5 · Modulkjede på innervegg.** I mockupen står kjeden på motsatt side av veggpillen. **Pillen kommer i et senere
  steg (Bjørn 4.11.2026): brukeren skal gjøre det meste rett på kanvas, uten å åpne skuffen.** Kjeden får derfor en
  fast regel nå: den står på siden mot standens midtpunkt. Pillen legges senere på den andre siden, så de aldri
  kolliderer. Kjeden skal ikke følge skuffens valgte side.

## Planen

Lagene og rekkefølgen i `PlanView.tsx` beholdes. Endringene per lag:

### Linjer og felles stil · `planStyle.ts`

Strekbredder oppgis i skjermpiksler og ganges med `u` (A4). Tilbudet og arbeidsordren tegner med 1,5 ganger bredden
(`lw`), så strekene tåler utskrift.

| Element | Stil |
| --- | --- |
| Rutenett 1 m | blekk 10 % (`rgb(var(--ink) / .1)`), hårstrek. Brukes som standard («linjer», ikke akser) |
| Gangfelt | som i dag, men uten teksten «Gang» |
| Sidetekster | som i dag (`Labels.tsx`). Standens bredde og dybde flyttes inn i målkjedene (se Mål) |

### Vegger · `layers/WallLayer.tsx`

- Systemvegg: en blekkstrek på 5 px. Kjernen er 3 px i platens RAL (`plateColor`) for alle plater, også standardfargen.
  Kanten blir da en tynn blekklinje på hver side. Appen tegner i dag kjernen bare når platen avviker; nå tegnes den
  alltid. Valgt vegg som i dag.
- Stolper: hvite firkanter med blekkkant, ikke fylt blekk (`BeamLayer.tsx`, `res.posts`).
- Dør: veggbladet 0,4 px og buen 0,6 px, stiplet bue som i dag. Forheng: sikksakk som i dag.
- Standens yttergrense tegnes ikke der en takdrager ligger. To streker oppå hverandre er vanskelige å lese.

### Tekstilvegg · `layers/TextileLayer.tsx`

Gjelder både InFrame (`v.textiles`) og frittstående (`res.production.free`):

1. blekkstrek 5 px (rammen)
2. appelsin 3,2 px oppå (fyllet)
3. tverrstreker oppå fyllet: blekk 50 %, 3,2 px bred strek, `strokeDasharray` 0,5 px strek og 4 px luft. **Bare i
   full detalj.**

Frittstående vegg har ingen egen tekst i planen (Bjørn 7.11.2026: ingen særbehandling). På arbeidsordren står
merkelappene `F1A`/`F1B` på hver side, se A2.

### Print og dekal · `layers/TextileLayer.tsx` (folie) og `domain/print.ts`

- Tegnes som et bånd **bare på siden som har trykk** (`sideOf(v, f)`), like bredt som dekalen (`foilCenter`,
  `f.width`). Et bånd på 2,4 px utenfor veggstreken.
- Grønn bunn, med rasterprikker oppå: mønster 2,4 × 2,4 px, prikk med radius 0,62 px i blekk 75 %.
- Helt trykt plate (`f.full`, og print over flere plater med `run`) dekker hele modulen.
- Den stiplede streken i dag fjernes.

### Takdrager · `layers/BeamLayer.tsx`

Takdragere tegnes stiplet, som på hallkartene.

- **Full detalj:** en kropp i `--surface` med blekk 9 % oppå, bredde `max(rules.beam.thickness, 3,6 px)`. Kroppen
  får to stiplede kantlinjer.
- **Compact:** én stiplet linje, som i dag.
- Innvendig takdrager (tegnet av kunden) som i dag, men samme form som over.
- **Mållinje for fritt plassert drager (T15):** tegnet som planens og veggrissets målkjeder (`DimChain.tsx`): dempet
  hårstrek, skråstreker og tallet ved siden, 9 px inn fra veggen eller drageren mot standens midte. Fra hver ende
  av en tegnet drager utenfor meterrasteret til nærmeste stolpe eller krok langs veggen eller drageren den henger på
  (`calc/beamOffsets.ts`). I tegneflaten på drageren som flyttes eller er valgt; på arbeidsordren for alle
  (`beamMeasures`), dempet sammen med takdragerne når arbeidsordren er filtrert bort fra dem. Ikke på tilbudet.

### Gulv · `layers/FloorLayer.tsx`

- **Dempet** (standard): fyll med 18 % opasitet uten fugelinjer. Flater med samme produkt slås sammen til én flate
  med en tynn kant rundt. Engangsteppe 22 %.
- **Full farge med fuger:** når gulvverktøyet er aktivt eller `highlight === 'floor'`. Arbeidsordre filtrert på gulv
  (`groups`) viser også full farge.
- Bruk den eksisterende `dim`-mekanismen der det går. Dette kommer i tillegg, ikke i stedet.
- **Fuger** (5.11.2026): hårstrek på 1 px (`JOINT_PX`, 1,5 px på dokumentene) i en sterk nyanse av gulvets egen
  farge (`jointColor`). Bare der to fliser eller baner møtes, ikke langs gulvets kant: kanten tegnes av vegger og
  standens omriss. Fugen er tynnere enn alle blekkstreker, så konstruksjonen ligger øverst. 3D som før.
- **Banemerke** på engangsteppe: nummer 12 px og pil 40 px (kortere på korte baner) i skjermpiksler (`LANE_MARK`).
- **Valgt bane eller fyll:** svak blekktone med stiplet blekkomriss og lys kant under, som siktet.
- **Kappet stripe** (svinn) bruker planens skravur (`HATCH`). Halvmeterlinjene under gulvpenselen er prikket blekk 0,5 px.

### Rom · `layers/RoomLayer.tsx`

Romnavn og mål står uten boks, rett på gulvet. Håndtakene som i dag, men ikke i `PlanPreview`.

### Mål (nytt lag) · `layers/DimLayer.tsx`

**Regel for alle mål (Bjørn 10.11.2026):** et mål som står på tegningen (plan, veggriss, tilbud, arbeidsordre) tegnes
alltid med målkjeden `Chain` i `plan/DimChain.tsx`: dempet hårstrek, skråstreker og tallet ved siden. Målpillen
(`MeasurePill`/`PillAt` i `layers/Previews.tsx`) er bare for live-tall mens man tegner eller drar. Ingen egne streker
eller piller for et nytt mål; hvor kjeden står regnes ut i `plan/dims.ts` eller `wallDrawer/elevationMeasure.ts`.

Planen har i dag bare `6 m` ved siden. Nytt lag med målkjeder i millimeter, tall i `--font-numeric`. Endemerker som
skråstreker på 2,5 px. Rader utenfor standen: nærmeste rad 9 px fra yttergrensen, totalmål 27 px.

Målhierarkiet:

| Tilstand | Mål som vises |
| --- | --- |
| Ingenting valgt | Totalmål på hver lukket side, og en plasseringsrad (kjede fra hjørnet til hvert innvendig veggfeste, rom og frittstående element langs siden) |
| Valgt standvegg | Veggens modulkjede (1 000 per modul) **erstatter plasseringsraden** på den siden, utenfor veggen. Totalen står |
| Valgt innervegg eller romvegg | Modulkjede tett på veggen, på siden mot standens midtpunkt (A5) |
| Valgt frittstående element | Fri lengde over elementet, som `2 350` på bilde 1 |
| Valgt tekstilvegg på vegg | Egen kjede foran siden den henger på: fra veggens ende, rammens fysiske bredde som i kalkyle og produksjon (970 i et felt på 1 000, rammen midt i feltet), til den andre enden. Veggens modulkjede vises ikke (Bjørn 6.11.2026) |
| Compact (A4) | Ingen modulkjede. Totalmål og plasseringsrad står |

Andre sider dempes ikke når en vegg er valgt.

### Tegnforklaring og tegningshode (nytt) · i gangfeltet foran

I det ytre hjørnet av gangfeltet foran standen, som tittelfeltet på en tegning (Bjørn 11.11.2026): tegningshodet
helt i hjørnet og tegnforklaringen til venstre for det, begge stående på gangfeltets nederkant. Toppen holder seg under
målkjedene langs fronten (totalraden der fronten har en, ellers plasseringsraden og målet på en valgt artikkel på
standgrensen). Er gangfeltet for smalt til to spalter, står de over hverandre i én. Se bilde 1:

- `TEGNFORKLARING`: ett gulv per rad med fargeprøve og areal (`res.keyFigures.floor`, flyttet fra `Labels.tsx`), og
  takdrager med strekprøve og løpemeter.
- `TEGNING`: «Variant A · 04.11.2026».
- Målestokk: 1 m i redigeringen, 2 m på tilbudet, som en stiplet blokk.

Overskrifter i små versaler 7,5 px. En rad som ikke får plass, faller bort, aldri tekst utenfor feltet.

## Veggrisset · `plan/wallDrawer/WallElevation.tsx`, `plan/elevation.tsx`

Veggskuffens tegning blir arbeidstegning for én vegg. Se bilde 3.

- **Overskrift:** «Venstre · sett innenfra · ← front   bakkant →». Navnet på siden og retningen til hver ende.
- **Målene følger det skuffen er åpnet for** (Bjørn 6.11.2026), som planen:
  - **Veggen:** modulkjede (1 000 per modul) og totalen under, og til venstre to høyder: «2 490 vegg» og
    «2 540 med føtter». Ingen plasseringsrad for tekstil og grafikk.
  - **Veggen med print lagt på** (malerspann eller malerkost med print valgt, Bjørn 6.11.2026): lysmål i stedet for
    modulkjede og vegghøyder. Under hvert felt den synlige platen, 960 (1 000 c/c minus stolpens 40), og totalen
    under. Til venstre 2 420 synlig høyde (2 490 minus topprofil 40 og bunnprofil 30) og 2 500 fra gulv; 80 fra
    gulv til synlig kant står når det får plass. Dørmoduler har ikke eget felt. Tallene kommer fra
    `rules.wall` (stolpe 94: platen synlig fra leppenes utside, 20 fra stolpesenter).
  - **Tekstilramme, dekal eller print:** over veggen plasseringsraden fra hver veggende og bredden (tekstil med
    rammens fysiske bredde, 3 970 i et felt på 4 000), til høyre høyderaden (bunn, høyde, rest til topp), og
    veggens total under. Ingen modulkjede og ingen vegghøyder. Print over flere plater måles som ett.
  - **Modulmål** (Bjørn 6.11.2026): en modul er 1 000 senter til senter stolpe, og veggene i et løp deler stolper.
    Modulkjeden står derfor merket «c/c». Totalen er fysisk, fra utsiden av endestolpene: 4 000 c/c er 4 040.
    Plasseringsraden over veggen regnes fra de samme utsidene, så den går opp i totalen (1 035 + 3 970 + 1 035 =
    6 040). Valgt tekstilvegg i planen måles likt. Senere kanskje: fra innvendig hjørne der en vegg møter, slik
    montøren måler.
- **Henvisningslinjer:** ingen merkelapp eller farge i veggrisset. Det valgte objektet får en prikk på toppen og en
  hårstrek (0,6 px, `--ink-muted`) opp til en tekst i målskriften (mono 10,5 px): produkttypen, med nummeret foran
  når «Vis posisjoner» er på. Tekstene står på én linje over plasseringsraden. Linjene forskyves 13 px om de
  overlapper.
- Rommet bak veggen («Bakrom») står i en `--sunken` flate som i dag.
- **Tekstilrammen slik den bygges** (Bjørn 8.11.2026, i planens oransje tekstilfarge, `TextileFace` i `plan/elevation.tsx`, mål i
  `wallDrawer/elevationMeasure.ts`): samme tegning på vegg og på fotplater. Rammen tegnes i fysisk mål (970 i et
  1 000-spenn) og der den står, også når den er flyttet 40 mm i et innvendig hjørne (X10). 43TX er en 40 mm kant,
  stagene (X8) stiplede stående bak duken, og en skinneskjøt (X6) et merke tvers over topp- og bunnskinnen. Valgt
  ramme får stagkjeden under veggen, avstanden mellom de stående (rammeende, stag) merket «stag», og veggens total
  under den. Skuffens tekst har ramme, fil, antall stag og skjøt. Frittstående har stagkjeden over rammen, føttene og
  hele lengden under.
- **Henvisninger** (Bjørn 8.11.2026, `labels` i `frame`): det skuffen er åpen for får ingen henvisning, tittelen sier
  hva det er. Med veggen valgt får hver tekstilramme («Tekstil 5 970 × 2 540»), dekal og print på siden sin
  henvisning; et print over flere plater er ett.
- **Notat på duken før motivet er valgt** (Bjørn 8.11.2026, `ui/textileNote.ts`): «Husk valg av motiv» på trykk uten
  motiv, «Kundens egen duk» på kundens duk, ingenting på hvit. Et svakt kryss fra hjørne til hjørne og en pille
  (fast skjermstørrelse, uten kant) langs diagonalen fra nede til venstre, så det passer alle rammestørrelser. I 3D
  står det samme på et gjennomsiktig ark over duken (`scene3d/build/note.ts`), aldri som fyll som ser ut som et
  motiv. Ikke på tilbudet eller arbeidsordren.

## Posisjonsnummer

- **Ett nummer per artikkel**, nummerert i den rekkefølgen tegningen gir dem: tekstil, platebytte, snekret, grafikk,
  dør, møbler. To like dører har samme nummer.
- Nøkkelen er artikkelen som prislinjen bruker (artnr eller quote-key fra `calc/quoteLines.ts`). En ren funksjon i
  `calc/` (forslag `positions.ts`) gir for hver tegnet ting artikkelen og nummeret, og for hver prislinje numrene.
  Den skal ha egne tester.
- **Tilbudet:** kolonnen `Pos.` (34 px) foran «Post» i prislisten, med en eller flere nummerbrikker per linje.
  Posisjonslisten under planen fra en tidligere mockup er forkastet.
- **Tegneflaten:** ingen nummer som standard. Innstillingen «Vis posisjoner i skissen» (av som standard) slår dem på.
  Peker man på et nummer, vises en mørk brikk med «4 Dør med lås · 960» og «2 stk i tegningen».
- **3D på tilbudet:** nummer på tekstilveggene.
- Kalkylepanelet får `Pos.` senere. Ikke i denne bestillingen.

## Tilbudet · `ui/quote/QuotePage.tsx`

Se bilde 4.

1. **3D-bilde øverst** i full bredde, omtrent 340 px høyt, fra 3D-visningens hjemmevinkel. Gjenbruk byggingen i
   `Scene3DPreview.tsx`. WebGL skrives ofte ikke ut, så tegn én gang og legg bildet inn som `<img>`
   (`renderer.domElement.toDataURL()` rett etter `render`). Utskrift og PDF må sjekkes.
2. **Planen** (`PlanPreview`, dokumentmodus: `lw` 1,5, ingen dato i hodet, ingen håndtak) til venstre, og faktalisten
   til høyre som i dag.
3. **Prislisten** med `Pos.`-kolonnen.

Arbeidsordren bruker samme `PlanPreview` og får planendringene automatisk.

## Rekkefølge

Bjørn 4.11.2026: **planskissen først.** Veggrisset og tilbudet kommer etterpå, og veggpillen er en egen bestilling.

Én PR per punkt. Hver PR kjører `scripts/shots.mjs` mot `main`, og avvikene skal være de ventede. Kalkyle- og
fil-snapshots (`src/test/fixtures.test.ts`) skal ikke endres. Kjør aldri `vitest -u` for å få dem grønne.

### Fase 1 · planskissen

1. **Skala og stil:** `u` og `detail` fra `PlanView` (A4), tokens og `planStyle.ts`, rutenett og gangfelt uten tekst.
2. **Vegger og stolper:** RAL på streken, hvite stolper, dørstreker, ingen yttergrense under takdrager.
3. **Tekstil, print og takdrager:** appelsin med tverrstreker, rasterbånd på trykksiden, takdragerkropp. A1 i samme PR.
4. **Gulvlaget:** dempet og aktivt.
5. **Mål:** `DimLayer` med hierarkiet over.
6. **Tegnforklaring og tegningshode** i gangfeltet. Romtekst uten boks.

Fase 1 endrer også planen på Tilbud og Arbeidsordre, fordi begge bruker `PlanPreview`. Det er ventet.

### Fase 2 · dokumentene

7. **Posisjoner:** `calc/positions.ts` med tester, `Pos.` i tilbudet, innstillingen og pekerbrikken i planen.
8. **Tilbudet:** 3D-bilde og dokumentmodus for planen. Sjekk utskrift til PDF.
9. **Veggrisset:** kjeder, høyder og henvisningslinjer. Det kan bli endret når pillen tar over mye av skuffen, så
   det kommer sist.

### Senere · veggpillen (egen bestilling)

Verktøylinje ved valgt vegg på kanvas, så det meste kan gjøres uten skuff. Den legges på motsatt side av modulkjeden
(A5) og skal aldri dekke et mål.

Når en PR er inne, oppdateres [kodekart.md](kodekart.md) med nye filer.

## Utenfor denne bestillingen

- Snekret vegg som produkt (A3).
- `Pos.` i kalkylepanelet.
- Farge per plate er bygget i appen (`v.panels`). Mockupen hadde bare farge per vegg, så her er appen foran.
- Trykksiden: mockupen antok at trykket alltid sitter på standsiden. Appen har `side` på folien og skal bruke den.
