# Byggeregler

Alle byggetekniske regler appen følger, med nummer, én gang. Hver regel sier hva som gjelder, hvem som bestemte den og
når, hvor verdiene står, hvilken kode som gjør det og hvilken test som passer på det. Bakgrunn, mål og tverrsnitt står
i [foga-system.md](foga-system.md), veggbegrepene i [vegger.md](vegger.md), pris og tid i [prismodell.md](prismodell.md).

## Slik brukes registeret

- **Nummeret er regelens navn.** Bokstaven er området (V vegg, S støtte, T takdrager, D dør, R rom, X tekstil, G gulv,
  P plukk, B hvem bygger, H hylle, K disk, F fysisk volum, M magnet og kobling). Et nummer brukes aldri om igjen: en regel som faller bort, blir stående som «utgått».
- **Én kilde per regel.** Regelen står her. Koden viser til nummeret («Byggeregel T7») i stedet for å gjenta teksten,
  og foga-system.md forklarer bakgrunnen.
- **Verdier er data.** Mål, avstander og antall står i `src/rules/rules.ts` (mål i meter) og `src/foga/recipes.ts`
  (deler og mm), aldri i regelkoden. Art.nr. står i `src/foga/parts.ts`.
- **Ny eller endret regel:** skriv den her først, legg verdiene i rules.ts eller recipes.ts, la koden vise til
  nummeret, og skriv en test som nevner nummeret. `src/test/byggeregler.test.ts` sjekker at hver regel har kode og en
  test som viser til den, at filene finnes, og at koden ikke viser til et nummer som ikke står her.

Formen er: **Nummer Navn.** Regelen. *Kilde · verdier · kode · test.*
Er en del av regelen bestemt, men ikke i koden ennå, står det «ikke bygget» etter kilden, med hva som mangler.

## V · Systemvegg

- **V1 Modul.** En systemvegg (standvegg, innervegg, romvegg) bygges i moduler på cc 1000 mellom stolpesentrene.
  Fysisk lengde er cc pluss én stolpe: 4000 c/c er 4040. Veggpenselen viser modulen et klikk lagrer, og et drag vokser fra
  den i hele meter (samme tegneverktøy som disk, `domain/runDraw.ts`); Shift («Fin» på iPad) bytter tegnestørrelsen til 250
  (Bjørn 14.11.2026): penselen viser 250 under pekeren, et klikk legger den og et drag vokser fra den i 250-steg, på
  hvilken som helst linje i 250-rasteret (V9); Shift trykket eller sluppet midt i
  draget låser det som er tegnet og går videre derfra. En strek over vegger som står legger bare til resten. Tøm tar en hel
  modul, også en kort. Kortere moduler finnes i samme steg som diskene (K10): 250, 500 og 750 c/c. En vegg legges i hele meter fra der den starter, og er lengden ikke
  hel, er den siste modulen kortere (1750 = 1000 + 750); står en dør utenfor hele meter, ligger den korte modulen nærmest døren (D8). Delene er de samme, kappet: skinnene c/c − 40 (210, 460, 710),
  platen c/c − 24 (226, 476, 726) og lysåpningen c/c − 40. Dør, forheng og hyller står bare i hele moduler. Tilbudet
  selger hele moduler per meter og hver kortere modul som eget produkt per stykk, priset som en hel meter (6121 for 750,
  6122 for 500, 6123 for 250; art.nr er plassholdere): jobben er den samme, og en kort plate brukes sjeldnere igjen. Kostnaden er de kappede skinnene og platen som sin andel av de hele
  (profilen per meter, platen etter bredde) og kappingen, plassholder 2 min per skinne og 3 per plate. Plukklisten
  viser de kappede lengdene.
  *Bjørn 31.10.2026, 6.11.2026 og 14.11.2026 · `rules.wall.cc`, `rules.wall.post`, `ITEM.rail`, `ITEM.cutPlate`, `ITEM.railCut`, `ITEM.plateCut` · kode `src/domain/walls.ts`, `src/domain/grid.ts`, `src/domain/faces.ts`, `src/calc/lines/walls.ts`, `src/calc/context.ts`, `src/cost/itemDefs.ts`, `src/foga/engine.ts`, `src/domain/runDraw.ts`, `src/ui/plan/pointer/run.ts` · test `src/foga/engine.test.ts`, `src/domain/shortModules.test.ts`, `src/calc/shortModules.test.ts`, `src/domain/runDraw.test.ts`*
- **V2 Stolpe.** Profil 94 (40 × 40) på 2490 mm i hvert stolpepunkt: ende, rett, hjørne, T og kryss. Moduler som møtes
  deler stolpe. Stolper som bare bærer takdrager er den samme stolpen.
  *Bjørn 31.10.2026 · `rules.wall.height`, `RECIPES.wall.post` · kode `src/foga/engine.ts` · test `src/foga/engine.test.ts`*
- **V3 Fot.** Innsats 700 og settskrue M10 × 65 i stolpens midtrør, 50 mm fra gulvet og justerbar. Systemhøyde fra
  gulv 2490 + 50 = 2540.
  *Bjørn 31.10.2026 · `rules.wall.feet`, `RECIPES.wall.feet` · kode `src/foga/engine.ts` · test `src/foga/engine.test.ts`*
- **V4 Skinner.** Toppskinne 92 og bunnskinne 91 mellom stolpene, 1000 − 40 = 960 mm, med én 600 i hver ende.
  *Bjørn 31.10.2026 · `RECIPES.wall.topRail`, `bottomRail`, `railCoupling` · kode `src/foga/engine.ts` · test `src/foga/engine.test.ts`*
- **V5 Veggplate.** Ikke Foga: lakkert HDF 3 mm, bestilt 976 × 2440 per RAL, én per modul. Lysåpningen er 960 × 2420
  (2490 − 40 − 30); platen står 8 mm inn i hver stolpe og 10 mm inn i skinnene. Én plate har samme farge på begge sider.
  *Bjørn 31.10.2026 · `RECIPES.wall.plate`, `rules.wall.plate` · kode `src/foga/engine.ts` · test `src/foga/engine.test.ts`*
- **V6 Standvegg er låst.** Veggene standtypen gir er standvegger: de kan ikke viskes, flyttes eller få dør. En vegg er
  standvegg fordi den kommer fra standtypen, aldri fordi den står i kanten. Unntaket med nabogodkjenning er ikke bygget.
  *Bjørn 31.10.2026 · kode `src/domain/walls.ts` · test `src/domain/standWalls.test.ts`*
- **V7 Innervegg.** Tegnes hvor som helst på standen, også ut mot kanten, men blir aldri standvegg. Flyttes i hele
  meter, med Shift eller «Fin» i 250 (V9, Bjørn 15.11.2026), ikke inn på en standvegg. Frittstående flyttes i begge retninger. Koblet til andre vegger flyttes den med dem som én gruppe (M2), og er gruppen koblet til en standvegg eller romvegg, bare til siden (M3).
  *Bjørn 31.10.2026, 1.11.2026 og 15.11.2026 · kode `src/domain/edit.ts`, `src/ui/drag.ts` · test `src/domain/standWalls.test.ts`, `src/ui/drag.test.ts`*
- **V9 Vegglinje.** En systemvegg eller tekstilvegg kan stå på hvilken som helst linje i 250-rasteret, ikke bare på
  metrelinjene. Uten Shift tegner penselen i hele meter på metrelinjene; med Shift eller «Fin» viser den 250 på den
  250-linjen som er nærmest pekeren, og draget svinger på 250-noder. Modulene legges i hele meter fra start og resten
  sist (V1). Rom står også i 250-rasteret (R5, R7).
  *Bjørn 14.11.2026 · kode `src/domain/grid.ts`, `src/domain/runDraw.ts` · test `src/domain/runDraw.test.ts`*
- **V10 Møte mellom stolper.** Treffer en vegg en annen vegg der den andre ikke har stolpe (en ende mot den, eller to
  vegger som krysser), deles modulen den treffer i to korte moduler med felles stolpe; resten av veggen beholder sine
  hele moduler (0–1, 1–2, 2–2,5, 2,5–3). Veggen som treffer, er da holdt der og står ikke fritt. Delingen avledes av
  hvor veggene står og lagres ikke: flyttes veggen, er modulen hel igjen. En modul med dør deles ikke. De to delene
  beholder fargen modulen hadde, og er hver sin flate for farge. Veggrisset (også arbeidsordrens veggriss med hyller) viser delene som egne plater med stolpen
  mellom og c/c-kjeden gjennom den, og penselen farger én del om gangen. Tøm tar hele modulen delene ble kappet av; langs
  en vegg utenfor metrelinjene går Tøm-streken på veggens linje i 250. Print og felt (hyller, dekal) per del er ikke
  bygget ennå: en delt plate tar ikke print.
  *Bjørn 14.11.2026 · kode `src/domain/walls.ts`, `src/ui/plan/wallDrawer/WallElevation.tsx`, `src/ui/workorder/ShelfElevation.tsx`, `src/ui/plan/pointer/stroke.ts` · test `src/domain/wallMeet.test.ts`, `src/domain/snapGrid.test.ts`*
- **V11 Delt standvegg.** Deles en standvegg arrangøren betaler (V10), beholder og fakturerer arrangøren den hele modulen
  den var, med sine stolper. Utstilleren betaler delingen: de korte modulene (V1) og stolpen mellom dem. Delene er
  utstillerens egne plater, så de er ikke platebytte.
  *Bjørn 14.11.2026 · kode `src/calc/context.ts`, `src/calc/lines/walls.ts` · test `src/domain/wallMeet.test.ts`*
- **V12 Mål utenfor hele meter.** En vegg utenfor metrelinjene (V9) får mål på arbeidsordrens plan, så montøren kan
  måle den ut: veggens linje én gang (ved en fri ende) og hver ende som ikke står på hel meter, hver fra nærmeste vegg
  eller standkant på tvers av målet. Mål som er hele meter vises ikke; montøren leser dem av rutenettet.
  Slått av foreløpig (Bjørn 14.11.2026): koden ligger klar, men arbeidsordren viser ikke målene (`wallMeasures`).
  *Bjørn 14.11.2026 · kode `src/domain/wallOffsets.ts`, `src/ui/plan/layers/DimLayer.tsx` · test `src/domain/wallOffsets.test.ts`*
- **V13 Endegrep på innervegg.** En valgt innervegg har et grep på hver fri ende (en ende ingen annen vegg eller
  tekstilvegg står mot), i Velg og med Vegg-pennen. Grepet flytter enden langs veggen i hele meter, 250 med Shift eller
  Fin; den andre enden står. Veggen kan gå inntil en annen vegg, ikke langs eller gjennom den, ikke utenfor standen og
  ikke kortere enn 250. En dør, folie, hylle eller tekstil som da ville falt utenfor eller havnet i en annen modul,
  stopper grepet (det stopper ved siste steg som går). Standvegger og romvegger har ingen endegrep.
  *Bjørn 14.11.2026 og 15.11.2026 · kode `src/domain/wallEnds.ts`, `src/ui/plan/grips.ts` · test `src/domain/wallEnds.test.ts`*
- **V14 Standareal i halve meter.** Standen er hele og halve meter på hver led, 1–40 m i steg på 0,5 i standbrikken.
  Metergitteret starter i hjørnet bak til venstre, så halvmeteren ligger mot høyre og mot fronten (gangen), og standveggene
  legges i hele meter fra hjørnet med halvmeteren sist (V1). En standvegg selges per løpemeter også med halvmeteren: 3,5 m
  standvegg er 3,5 lm, også til arrangøren. Innervegger og romvegger selger korte moduler per stykk som før (V1), og en
  standvegg delt av en annen vegg følger V11. Penslene slutter i standkanten: i halvmeteren viser vegg-, tekstil- og
  takdragerpenselen en 500 ut til kanten, og et klikk legger den; et drag i hele meter tar halvmeteren som siste steg når
  pekeren er forbi midten av den. Tøm gjør det samme. Standkanten er en metrelinje, så en vegg dit får ikke mål (V12).
  Takdragerreglene gjelder som før: langs en åpen side hele meter og halvmeteren sist (T2, T18), en tverrdrager fra en
  skjøt likedan, støttedrageren 3 m fra hjørnet (T7) og fotplater når veggene står fritt (S2).
  Andre mål og diagonaler kan komme senere, men ikke nå.
  *Bjørn 15.11.2026 · kode `src/ui/panel/StandSettings.tsx`, `src/domain/grid.ts`, `src/calc/lines/walls.ts`, `src/ui/plan/PlanView.tsx`, `src/domain/runDraw.ts`, `src/domain/snapGrid.ts`, `src/ui/plan/pointer/stroke.ts`, `src/domain/wallOffsets.ts`, `src/domain/innerBeams.ts` · test `src/calc/halfMetreStand.test.ts`, `src/domain/halfMetreStand.test.ts`, `src/calc/halfMetreBeams.test.ts`*

- **V15 Plateregelen: farge og print på plater.** Én regel for alle plater av Foga-profiler og veggplater, hva produktet
  enn er (felles plateregel, Bjørn 18.11.2026). Produktet (6120, 6130, 6560, 6570) er en kombinasjon av plater og
  profiler og bærer prisen; platen bærer fargen og printen. En plate er et felt i en vegg (også en del av en delt modul,
  V10), en dørs overstykke og dørblad (hver for seg) og en disks lysåpning (skyvedøren der er én flate, K6);
  `domain/plates.ts` lister dem alle.
  - *Siste strøk vinner* på det du peker på: en farge med kosten, på en valgt plate, med veggpennen i planen eller på et
    dørblad tar printen av den platen på siden du ser. Fargen gjelder begge sider av platen. Dekaler blir: de dekker
    ikke hele platen.
  - *Print skjuler fargen:* en plate printet på alle sider som kan ha dekor (en standvegg innsiden, en disk utsiden) har
    ingen egen farge, og er hele veggen eller disken printet, får den sin grunnfarge igjen. En plate betales aldri både
    som farge og som print, og et platebytte regnes aldri for en farge ingen ser.
  - *Kosten* legger hele motivet på platen den treffer, beskåret, aldri strukket ut av form. *Spannet* legger ett bilde
    over alle platene på siden som vises, og hver plate viser sin del; kosten på en plate i bildet gir den hele motivet.
    På en dør gjelder det overstykket og bladet hver for seg, og spannet ett bilde over begge.
  - *Samme motiv igjen gjør ingenting*, med spann, kost, Print-pennen og motivtrykk på en valgt plate.
  - Spann og kost virker likt i alle skuffer: veggskuffen og diskskuffen sier bare hva platen er (`strokeAt`).
  - *Fjern farge og print* (viskelæret i fargeseksjonen, Bjørn 19.11.2026) virker likt i alle skuffer og på alle
    byggesystem (`clearSurface`): det som er valgt mister sin egen farge og printen på siden du ser, og får fargen til
    det det er en del av. Et felt får veggens farge, hele veggen (rommet) og dørbladet standens, overstykket veggens, og
    en diskplate eller hele siden diskens. Dekaler, hyller og tekstilrammer blir: de fjernes én og én. Viskelæret er grått
    når det ikke er noe å ta av. Søppelbøtta øverst i skuffen fjerner bare tingen selv (vegg, dør, disk, dekal, hylle).
  Tekstilveggene husker motivet når duken blir Hvit eller Kundens, så det kommer tilbake med Trykk. Det som er eget for
  disken står i K6 og K20.
  *Bjørn 3.11.2026, 18.11.2026 og 19.11.2026 · kode `src/domain/paint.ts`, `src/domain/print.ts`, `src/domain/podiumDecor.ts`, `src/ui/plan/paintTools.ts`, `src/domain/plates.ts`, `src/domain/textile/free.ts` · test `src/domain/paint.test.ts`, `src/domain/print.test.ts`, `src/domain/podiumDecor.test.ts`, `src/ui/plan/paintTools.test.ts`, `src/domain/plates.test.ts`, `src/domain/textile/free.test.ts`*
- **V16 Print er et valg.** Et strøk over mange plater lar print stå: malerspannet i skuffen farger resten av siden og
  hopper alltid over plater og dørflater med print, på vegg og disk, så de øvrige kan få ny farge uten å legge printen på
  igjen. Fyll på hele standen (Vegg-pillens spann og standfargen i panelet, som er det samme) gjør likedan, og toasten
  sier «N felt med print står som før» med valget «Farg også dem». Valget står over tegningen som en toast, aldri i
  skuffen eller panelet, så ingen innstilling skyves ut av syne.
  *Bjørn 18.11.2026 · kode `src/domain/paint.ts`, `src/ui/fillKeeping.ts` · test `src/domain/paint.test.ts`*
- **V17 Fargen følger platen.** En plates egen farge hører til platen, ikke til stedet i planen. Flyttes veggen hel,
  også langs linjen sin, går fargene med; strekkes eller kuttes den, står hver plate med sin farge der den står; blir
  veggen delt i to eller til en romside, beholder platen fargen der den står. Dørbladets farge følger døren. Fjernes
  platen eller døren, går fargen også, så en vegg tegnet der senere får sin egen farge. På disken følger farge og print
  lysåpningen når en hylle settes inn eller tas ut (K19).
  *Bjørn 18.11.2026 (felles plateregel, trinn B1) · kode `src/domain/plateDecor.ts` · test `src/domain/plateDecor.test.ts`, `src/domain/plates.test.ts`*
## S · Støtte for systemvegg

- **S1 Rammen holder.** Med takdrager på står standveggene i takdragerrammen og får ingen fotplater.
  *Bjørn 1.11.2026 · kode `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S2 Fotplate.** En systemvegg som står fritt (takdragerne valgt bort, eller en inner- eller romvegg rammen ikke
  holder) får fotplate 750 (500 × 80 × 5) med stolpefeste 795 under stolper, midt under veggen og på tvers av den.
  Platen stikker inn til naboen og ut i gangen; det er godtatt.
  *Bjørn 1.11.2026 · `RECIPES.wall.support` · kode `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S3 Avstand.** Per rett strekning: en plate i hver fri ende, maks 3 m mellom to støtter, og en endeplate trekkes inn
  hele stolper (maks 1 m) bare så langt avstanden krever. Minst 2 gjelder bare en rett vegg fri i begge ender, fra 1 m.
  3 m: endene. 4 m: den ene 1 m inn. 5 m: begge 1 m inn. 6 m: tre. Avstandene regnes i meter langs veggen, så en kort
  modul (V1, V10, D8) teller med sin lengde, og en vegg delt i korte moduler er fortsatt én strekning (Bjørn 15.11.2026).
  *Bjørn 1.11.2026 · `RECIPES.wall.support.rule` · kode `src/calc/supports.ts`, `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S4 Ut fra hjørne.** Ut fra et hjørne eller en T står veggen av seg selv opptil 1 m (1 × 1 trenger ingen plate). Over
  1 m får den én plate, deretter gjelder S3.
  *Bjørn 3.11.2026 · kode `src/calc/supports.ts` · test `src/calc/wallSupports.test.ts`*
- **S5 Hva som holder.** Et hjørne, en T eller et kryss med en annen systemvegg (et rom holder veggene det står
  inntil), og en stolpe under en takdrager.
  *Bjørn 1.11.2026 · kode `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S6 Fire låste sider.** Med takdrager på får en strekning som er holdt i begge ender, og der endene henger sammen
  rundt en annen vei med vegger og takdragere (en lukket firkant), ingen plater. Det gjelder også vegger og dragere
  utenfor hele meter (V9, T15): en drager henger sammen med hver stolpe og dragerende som ligger på den, og en drager
  på krok på veggen mellom stolpene (T15) er et hjørne i firkanten.
  *Bjørn 3.11.2026 · kode `src/calc/wallSupports.ts` · test `src/calc/beams/supportBeams.test.ts`*
- **S7 Uten takdrager.** Er takdragerne valgt bort, gjelder S3 også mellom to hjørner: en bakvegg på 6 m får én plate
  midt på.
  *Bjørn 1.11.2026 · kode `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S8 Stolpe på plate.** En stolpe over en fotplate plukkes uten justeringsfot («Stolpe 94 uten fot»). Står platen
  under arrangørens stolpe, skrus foten ut på stedet.
  *Bjørn 1.11.2026 · kode `src/foga/engine.ts` · test `src/calc/wallSupports.test.ts`*

## T · Takdrager

- **T1 Profil.** 292 (80 × 20), maks 6 m i én lengde, kappet senteravstand − 40, med 2 × 600 i hver ende (en oppe og
  en nede, i ytterkamrene). Underkant 2460, topp i flukt med veggene (2540).
  *Bjørn 31.10.2026 og 6.11.2026 · `rules.beam`, `RECIPES.beam` · kode `src/foga/engine.ts` · test `src/foga/engine.test.ts`*
- **T2 Deling.** En strekning deles i færrest mulige lengder på maks 6 m, så like som mulig, med skjøter i hele meter:
  7 → 4 + 3, 13 → 5 + 4 + 4. Det er stolpe i hver skjøt. En halv meter legges sist på løpet, på den siste lengden
  (7,5 → 4 + 3,5), og skjøtes på etter T18.
  *Bjørn 31.10.2026 · `rules.beam.max` · kode `src/calc/beams/beamSegments.ts`, `src/calc/beams/beams.ts` · test `src/calc/calc.test.ts`*
- **T3 Standard takdrager.** Legges langs de åpne sidene av standen. En ende mot en vegg deler veggens stolpe.
  *Bjørn 31.10.2026 · kode `src/calc/beams/beams.ts` · test `src/calc/calc.test.ts`*
- **T4 Vegg deler drageren.** Der en vegg møter eller krysser en takdrager i en av veggens stolper, også enden av en
  inner- eller romvegg og også utenfor metrelinjene (V9), deles drageren og deler veggens stolpe. Hver side er egen
  lengde etter T2. Krysser veggen mellom stolpene, gjelder T17.
  *Bjørn 1.11.2026 og 14.11.2026 · kode `src/calc/beams/beams.ts`, `src/calc/beams/wallLines.ts` · test `src/calc/calc.test.ts`, `src/calc/beams/offGridWalls.test.ts`*
- **T5 Tverrdrager.** Fra hver 6 m-skjøt går en tverrdrager inn til motstående vegg eller side. Den går videre forbi en
  vegg som møter eller krysser den, delt på veggens stolpe, og stopper bare der en vegg går langs linjen.
  *Bjørn 1.11.2026 · kode `src/calc/beams/beams.ts` · test `src/calc/calc.test.ts`*
- **T6 Følger standveggene.** En øy har ingen standvegger og får ingen standard takdrager, men kan slå dem på. Kunden kan
  velge bort takdragerne (`Variant.noBeams`); da står veggene fritt (S2).
  *Bjørn 1.11.2026 og 3.11.2026 · kode `src/domain/walls.ts` · test `src/calc/beams/supportBeams.test.ts`*
- **T7 Støttedrager.** En standvegg med et fritt spenn på 6 m mellom to punkter som holder den (hjørne, T, en takdrager
  som hviler på den) får én støttedrager 3 m fra hjørnet. Den går rett inn til det første den møter, en vegg eller en
  takdrager: deler stolpen på en vegg eller stolpe, henger på krok på lengden av en drager, og stopper foran en vegg
  langs linjen. Et lengre spenn får én per 6 m. Den er en standard takdrager. Uten takdrager blir det fotplater (S2).
  *Bjørn 3.11.2026 · `rules.beam.supportSpan` · kode `src/calc/beams/supportBeams.ts` · test `src/calc/beams/supportBeams.test.ts`*
- **T8 Innvendig takdrager.** Tegnes av kunden, rett innenfor standen i hele og halve meter: uten Shift i hele meter,
  med Shift eller «Fin» i 500 fra et punkt på halvmeterrutenettet (da gjelder T15 der den ikke treffer stolper), minst en
  halv meter, aldri langs en vegg eller oppå en annen takdrager, også når endene står på en halv meter. Dra i Velg flytter
  den i hele meter, med Shift eller «Fin» i 500 langs drageren (og 50 mm på tvers, T15). Samme profil, høyde og deling
  (T1, T2) som standard.
  *Bjørn 1.11.2026 og 15.11.2026 · kode `src/domain/innerBeams.ts`, `src/calc/beams/innerBeams.ts` · test `src/domain/innerBeams.test.ts`*
- **T9 Krok.** En ende som treffer en annen takdrager henger på den med krok: ingen stolpe der, og drageren den henger
  på deles ikke. Én krok per krokpunkt, i 01 som en T over drageren: enveis (ett ben) når dragere henger fra én side,
  toveis (to ben) fra begge. Festes med M5 maskinskrue i 503. Plukkes hel, uten eget art.nr. og uten kost eller pris.
  *Bjørn 1.11.2026, 10.11.2026 · `RECIPES.beam.hook` · kode `src/calc/beams/innerBeams.ts`, `src/calc/beams/beamHooks.ts` · test `src/calc/beams/innerBeams.test.ts`, `src/calc/beams/beamHooks.test.ts`*
- **T10 Kryss.** Der to tegnede takdragere krysser, går det lengste spennet gjennom og det korteste deles og henger på
  krok på hver side. Like lange: den først tegnede går gjennom. En tegnet drager som krysser en standard deles likt.
  Ligger de i hver sin høyde, deles ingen av dem (T16).
  *Bjørn 1.11.2026 · kode `src/calc/beams/innerBeams.ts` · test `src/calc/beams/innerBeams.test.ts`*
- **T11 Vegg langs drageren vinner.** Havner en vegg (innervegg, romside, dør, standvegg) langs en tegnet takdrager,
  bygges ikke den biten. Drageren stopper på veggens stolper, veggen regnes ikke som holdt av den, og drageren kommer
  tilbake når veggen flyttes bort. Over et rom er lov: drageren hviler på romveggene.
  *Bjørn 1.11.2026 · kode `src/calc/beams/innerBeams.ts` · test `src/calc/beams/innerBeams.test.ts`*
- **T12 Egne stolper.** En tegnet takdrager har stolper bare i frie ender og 6 m-skjøter (ikke i halvmeterskjøten, T18), og ingen tverrdrager. Under
  hver egen stolpe står fotplate 750 med 795 på tvers av drageren; den faller bort der en drager fra den andre retningen
  (tegnet eller støttedrager) møter stolpen.
  *Bjørn 1.11.2026 · kode `src/calc/beams/innerBeams.ts`, `src/calc/beams/beams.ts` · test `src/calc/beams/innerBeams.test.ts`*
- **T13 Over tekstilvegg.** En takdrager kan ikke kobles på en tekstilvegg (InFrame eller frittstående, begge 43TX).
  Tar drageren og en tekstilramme som når opp til dragerens underkant samme plass i plan, heves hele løpet (lengdene i
  samme rette linje som møtes ende mot ende) 80 mm. Gjelder alle takdragere. Bare fysisk konflikt teller, ikke innsyn.
  *Bjørn 6.11.2026 · `RECIPES.beam.lift` · kode `src/calc/beams/beamLift.ts` · test `src/calc/beams/beamLift.test.ts`*
- **T14 Skjøt.** Hver stolpe et hevet løp hviler på, også en veggstolpe, får 94 × 80 med 609 ned i stolpen. Der en hevet
  drager henger på en som ikke er hevet, eller omvendt, står samme stykke med 600 mot den andre drageren, i høyden til
  drageren som henger der.
  *Bjørn 6.11.2026 · `RECIPES.beam.lift` · kode `src/calc/beams/beamLift.ts` · test `src/calc/beams/beamLift.test.ts`*
- **T15 Fritt plassert innvendig takdrager.** En tegnet takdrager kan flyttes ut av meterrasteret på tvers av sin
  retning (50 mm-steg), som oftest for å henge lys der det trengs. Treffer den en systemvegg mellom stolpene (også over
  et dørstykke), henger den på krok 01 satt som T over toppskinne 92; krysser den veggen, deles den der og henger på
  toveis krok. Kryss med andre dragere mellom hele meter finnes som ellers (T10), og en støttedrager stopper på den.
  En fri ende får egen stolpe med fotplate, også utenfor rasteret. Er den hevet over en tekstilvegg (T13), står
  94 × 80 med 600 oppå veggen i stedet for kroken. Bare tegnede dragere flyttes; en ledig stolpe brukes alltid.
  Kroken plukkes av Production uansett hvem som betaler. En drager på krok holder veggen der, som en drager på en
  stolpe: fotplatene (S-reglene) og støttedrageren (T7) regnes for hver strekning mellom holdte punkter, med platene
  fortsatt på stolpene. I planen flytter Shift + dra i Velg drageren på tvers i 50 mm-steg (på berøring: «Fin» i pillen, på
  så lenge drageren er valgt); en hel meter setter den tilbake i rasteret. Mållinje fra hver ende til nærmeste stolpe eller krok langs veggen eller drageren den henger på, på
  drageren som flyttes eller er valgt, og på arbeidsordrens plan for alle slike dragere så montøren kan måle ut.
  *Bjørn 10.11.2026 · `RECIPES.beam.hook`, `RECIPES.beam.lift` · kode `src/domain/innerBeams.ts`, `src/calc/beams/innerBeams.ts`, `src/calc/beams/beamHooks.ts`, `src/calc/beams/beamLift.ts`, `src/calc/wallSupports.ts`, `src/calc/beams/supportBeams.ts`, `src/calc/beams/beamOffsets.ts`, `src/ui/workorder/WorkOrderPage.tsx` · test `src/calc/beams/offGridBeams.test.ts`, `src/domain/innerBeams.test.ts`*
- **T16 Hel lengde over et annet nivå.** Hele lengder går foran. En hevet drager (T13) ligger en dragerhøyde over de
  andre, så der en hevet og en ikke hevet drager krysser, deles ingen av dem (unntak fra T10): den hevede ligger løst
  oppå den andre, og det står ikke noe 94 × 80 i krysset. Det gjelder begge veier, også når det er drageren som går
  gjennom som er hevet. På samme måte går en hevet drager over en systemvegg mellom stolpene uten å deles (T15). Der
  holder den ikke veggen: en drager som bare ligger oppå, uten stolpe, krok eller skjøtestykke, er ingen støtte, så
  veggen får fotplater som uten drageren (S-reglene). Den deles fortsatt på en stolpe (T4, T14). Løst oppå er nok så lenge den
  hele lengden er høyst 6 m (T2) og festet i hver ende til en stolpe, en vegg eller en tverrgående drager; blir den
  lengre, står skjøten i krysset som før, med 94 × 80 oppå. En ende som henger på en drager (T9) er uendret. To hevede
  dragere ligger i samme høyde og følger T10.
  *Bjørn 10.11.2026 · `rules.beam.max` · kode `src/calc/beams/beamLift.ts`, `src/calc/context.ts` · test `src/calc/beams/beamLift.test.ts`*
- **T17 Uten stolpe heves.** En standard takdrager (langs siden, tverrdrager) som krysser en vegg mellom veggens
  stolper, finner ingen stolpe å hvile på: hele løpet heves over veggen som ved T13, med 94 × 80 på stolpene (T14), og
  ligger løst oppå veggen (T16). En vegg langs drageren stenger den strekningen, også utenfor metrelinjene (T11), og
  drageren deler veggens endestolpe. En tegnet takdrager henger fortsatt på krok der den møter en vegg mellom stolpene
  (T15), og en støttedrager (T7) stopper på krok der.
  *Bjørn 14.11.2026 · kode `src/calc/beams/beamLift.ts`, `src/calc/beams/beams.ts`, `src/calc/beams/supportBeams.ts`, `src/calc/beams/innerBeams.ts`, `src/calc/beams/wallLines.ts` · test `src/calc/beams/offGridWalls.test.ts`*
- **T18 Halv meter skjøtes på.** En takdrager kappes aldri til en lengde som 1460. En lengde i hele og halve meter er en
  hel lengde og en 500 (kappet 460, med 2 × 600 i hver ende som alle lengder, T1) skjøtet ende mot ende med en stående 92
  på 80 mm: de 2 × 600 i enden av hver drager går inn i 92-stykket, som i en stolpe. Det står ingen stolpe i den
  skjøten. Tilbudet har samme meterpris (lm).
  *Bjørn 15.11.2026 · `RECIPES.beam.half` · kode `src/foga/fromVariant.ts`, `src/foga/engine.ts`, `src/calc/lines/beams.ts` · test `src/calc/beams/halfBeams.test.ts`*

## D · Dør og forheng

- **D1 Dør.** Fogas ferdige dør: karm i 292 med lås 410 ferdig montert, plukkes som ett dørblad. Bladet er 2000 høyt og
  950 bredt, sentrert i lysåpningen og hengslet på innsiden av stolpen. Lås og nøkler følger alltid med.
  *Bjørn 31.10.2026 og 1.11.2026 · `RECIPES.door`, `rules.door` · kode `src/foga/recipes.ts` · test `src/domain/doors.test.ts`*
- **D2 Overstykke.** 20 mm luft under bladet og 10 mm over, regnet fra stolpen på 2490 uten fot: overstykket er
  2490 − 20 − 2000 − 10 = 460, med toppskinne 92 og bunnskinne 91 (960 med 600) og HDF 976 × 410, bygd som en
  veggmodul (91 med kanalen opp). Forheng får samme overstykke, men med **92 i bunn**: forhenget henger i en glider i
  sporet (Bjørn 6.11.2026), så platen blir 460 − 40 − 40 + 20 = 976 × 400.
  *Bjørn 31.10.2026 og 6.11.2026 · `RECIPES.door` · kode `src/foga/engine.ts`, `src/domain/doors.ts`, `src/ui/scene3d/build/walls.ts`, `src/ui/plan/elevation.tsx` · test `src/calc/calc.test.ts`, `src/foga/engine.test.ts`, `src/domain/doors.test.ts`*
- **D3 Hvor den kan stå.** Aldri i en standvegg. Lov i innervegg, romside, på tom gulvkant og mot åpne sider; mot gangen
  slår bladet alltid inn i standen. En åpning er aldri veggmeter, men teller som vegg for takdragerne.
  *Bjørn 31.10.2026 · kode `src/domain/walls.ts`, `src/domain/doors.ts` · test `src/domain/edit.test.ts`*
- **D4 Døren følger rommet.** Flyttes eller endres et rom slik at døren ville havnet i en standvegg, flyttes døren til
  nærmeste modul på rommet der den kan stå. Flyttet nektes bare når rommet ikke har noen slik modul.
  *Bjørn 2.11.2026 · kode `src/domain/doors.ts` · test `src/domain/doors.test.ts`*
- **D5 Dørbladets oppbygning.** Rammen er 292 med 80 synlig forfra, så bladet er 20 tykt. Stående profiler går i full
  høyde (2000), liggerne sitter mellom dem. Én veggplate (samme HDF som i veggen) i kanalene, og bare platen har
  dørfargen; rammen er alu. To hengsler 403, ett nær toppen og ett nær bunnen (150 inn). Lås 410 med sort rosett og
  vrider på den frie stolpen; utsiden tegnes og settes likt på innsiden (innvendig er det egentlig en smal stålvrider).
  Print over døren vises bare i lysåpningene: på overstykket mellom 91 og 92 (960 × 390) og på dørbladet innenfor
  292-rammen (790 × 1840); rammen og skinnene dekker sin stripe av bildet, som stolpene mellom veggplatene.
  Gjelder 3D og veggtegningen i skuffen; døren plukkes fortsatt som én enhet (D1).
  *Bjørn 6.11.2026 · `RECIPES.door` · kode `src/ui/scene3d/build/doors.ts`, `src/ui/plan/elevation.tsx`, `src/domain/doors.ts` · test `src/ui/scene3d/build.test.ts`, `src/domain/doors.test.ts`*
- **D6 Forhengets farge.** Forheng finnes i sort, grå og blå; sort er standard. Samme art.nr og pris, fargen står på
  linjen («Forheng med overstykke · sort»), og to forheng i ulik farge er to artikler. Dørbladet tar veggfargene (RAL).
  *Bjørn 14.11.2026 · `fabrics` på 6131 · kode `src/catalog/defaultCatalog.ts`, `src/calc/lines/doors.ts`, `src/domain/doors.ts` · test `src/domain/doors.test.ts`, `src/ui/wallPen.test.ts`*

- **D7 Fri slagside.** En dør trenger 1 m² fri gulvflate på siden bladet slår til: modulens 1 m bredde og 1 m ut fra
  veggen, innenfor standen, uten vegg eller frittstående tekstil inn i flaten (vegger langs kantene, som dørens egen
  og en vegg som møter ved hengslet, teller ikke) og uten møbel eller disk i den. Møbler og disker kan heller ikke
  settes eller flyttes inn i flaten, så de ikke stenger for folk som går (Bjørn 15.11.2026). To dørers flater kan
  heller ikke overlappe, av sikkerhetshensyn (Bjørn 15.11.2026). Er siden ikke fri,
  snus dørbladet; er ingen side fri, settes ikke døren. En senere endring som ville stengt begge sider av en dør,
  nektes med melding. Mot gangen slår døren alltid inn (D3), så der må innsiden være fri.
  *Bjørn 15.11.2026 · kode `src/domain/doors.ts`, `src/domain/objects.ts`, `src/ui/edits.ts` · test `src/domain/doorSwing.test.ts`*
- **D8 Dør utenfor hele meter.** En dør eller et forheng kan stå utenfor metrerutenettet (i 250). Døren har alltid sin
  egen 1000-modul; resten av veggen legges i hele moduler med den korte modulen (250, 500 eller 750) nærmest døren, for
  eksempel 1000 · 250 · dør · 1000 · 750. Korte moduler har egne art.nr (6121–6123), plassholderpris som hel meter.
  Gjelder også romsider. Hyller og feltfarge bare på hele 1000-moduler.
  Veggens brudd settes bare ett sted, når veggene skrives på nytt (`replaceWalls`), fra der dørene står; flyttes eller
  endres et rom, beholder dører og forheng sin plass på siden. Kalkylen teller de korte modulene med sine art.nr.
  En valgt dør eller et forheng har et flyttegrep midt på: dras langs veggen i hele meter, med Shift eller Fin i 250, i
  planen og i 3D, med Velg og med Dør-pennen. Døren stopper ved veggens ende, en annen åpning, hylle, print eller tekstil.
  Dør-pennen med Shift eller Fin setter en ny dør eller et forheng på en vegg i 250, midt på pekeren, med de samme grensene.
  *Bjørn 15.11.2026 · `Wall.breaks` · kode `src/domain/grid.ts`, `src/domain/replaceWalls.ts`, `src/domain/rooms.ts`, `src/domain/doors.ts`, `src/ui/plan/grips.ts`, `src/ui/plan/pointer/opening.ts` · test `src/domain/moduleSpans.test.ts`, `src/domain/doorOffMetre.test.ts`, `src/ui/plan/doorGrip.test.ts`*
## R · Rom

- **R1 Bare det som mangler.** Et rom bygger bare veggene som ikke finnes. Står det inntil en standvegg, gjenbrukes den;
  to rom side om side deler veggen.
  *Bjørn 31.10.2026 · kode `src/domain/rooms.ts` · test `src/domain/rooms.test.ts`*
- **R2 Form.** Et rom har ikke tak. Omrisset er rettvinklet (rektangel, L, U, T, Z) uten hull, og ingen side er under
  250, rutenettets minste steg (R5; Bjørn 15.11.2026: et frihåndsrom med en side på 500 skal bli rom). En L kan dras til et rektangel; et rektangel blir L bare ved å tegne vegger.
  *Bjørn 31.10.2026 · kode `src/domain/outline.ts`, `src/domain/rooms.ts` · test `src/domain/rooms.test.ts`*
- **R3 Frihåndsrom.** Vegger som lukker et område med en dør, blir et rom. Siden en dør ikke kan stå i en standvegg, kan
  ikke en standvegg alene lukke et rom. Det gjelder uansett hvordan området blir lukket: en vegg tegnet, en dør satt,
  en vegg dratt på plass (i planen eller i 3D) eller dratt i et endegrep. Et drag ses som én endring fra der det begynte,
  så et område som var lukket med dør før draget, forblir vegger. Rommet blir eget angresteg og velges med gripene sine
  (R8) (Bjørn 15.11.2026).
  *Bjørn 31.10.2026 · kode `src/domain/enclosures.ts`, `src/ui/useCloseRooms.ts` · test `src/domain/enclosures.test.ts`*
- **R4 Det som står i rommet.** Møbler i rommet følger rommet, og en tekstilvegg som fyller en romside vokser og krymper
  med den.
  *Bjørn 31.10.2026 · kode `src/domain/rooms.ts` · test `src/domain/rooms.test.ts`*
- **R5 Rom i 250.** Et roms hjørner står i 250-rutenettet, ikke bare på metrelinjene. Uten Shift flyttes og strekkes
  rommet i hele meter fra der det står; med Shift, eller «Fin» i rommets pille, i 250, i planen og i 3D. Hver side har hele meter først og resten sist, regnet med klokka rundt rommet, med reglene for korte moduler (V1); dører og
  forheng har alltid en hel 1000-modul. Flyttes en sides start et stykke som ikke er hel meter, beholder dører og forheng
  plassen sin (D8), mens felt beholder modulnummeret sitt fra starten.
  *Bjørn 14.11.2026 · kode `src/domain/outline.ts`, `src/domain/rooms.ts`, `src/ui/drag.ts` · test `src/domain/rooms250.test.ts`*
- **R6 Romside langs en vegg.** Ligger en romside på samme linje som en vegg med andre modulgrenser, bygger rommet bare
  strekningen som mangler, regnet etter hvor veggene står og ikke etter modulene (R1). Det som bygges av en modul som
  bare delvis mangler, er en del av den modulen med egen stolpe (V10). En dør på en romside som allerede er bygget av
  en annen vegg, må stå i en hel modul av den veggen.
  *Bjørn 14.11.2026 · kode `src/domain/walls.ts` · test `src/domain/rooms250.test.ts`*
- **R7 Frihåndsrom i 250.** Området et frihåndsrom (R3) lukker, finnes i 250 × 250-celler, så vegger utenfor
  metrelinjene (V9) lukker rom også, med sider ned til 250 (R2).
  *Bjørn 14.11.2026 · kode `src/domain/enclosures.ts` · test `src/domain/rooms250.test.ts`*
- **R8 Grep på valgt rom.** Et valgt rom viser grep som en valgt disk (K14), i Velg: ett midt på hver side og ett i
  hvert hjørne av boksen rundt (flytter de to sidene av boksen som møtes der, med alle sider av omrisset som ligger på
  dem). Hele siden tar også tak i sidens grep, så en side mot en standvegg kan dras. Et grep flytter i hele meter, 250
  med Shift eller Fin (R5); hver vei for seg stopper der rommet fortsatt får plass. Under draget vises rommet slik
  slipp lagrer det, med målet i pillen og det rommet gir fra seg skravert, og møbler som må flytte, der de havner.
  Går det ikke i noen retning: «Rommet får ikke plass slik». Midt i rommet (der navnet står) står et flyttegrep, et
  større rundt grep med fire piler, under navnet: det flytter hele rommet som et drag i gulvet. Det vises med en penn i
  hånden, ikke i Velg, der hele rommet flyttes ved å dra i gulvet. Grepene virker også med Vegg-pennen, som på en disk
  (K14): et valgt rom forblir valgt når Vegg velges, og et rom som en vegg-strek lukker, blir valgt. Grepene er den
  eneste måten å endre størrelsen på i 3D også: toppkanten av en romvegg lyser ikke lenger ved hover, og et drag i en
  romvegg flytter rommet (Bjørn 15.11.2026).
  *Bjørn 15.11.2026 · kode `src/domain/roomGrips.ts`, `src/ui/plan/grips.ts` · test `src/domain/roomGrips.test.ts`*

## X · Tekstilvegg (43TX)

- **X1 Én tekstilvegg.** InFrame og frittstående er samme produkt, samme 43TX-ramme med duk: frittstående er InFrame på
  fotplater. Bare monteringen er ulik: på en systemvegg festes rammen med 520 til stolpene og har duk på siden ut fra
  veggen; på fotplater står den fritt og har duk på begge sider. Reglene for selve rammen (mål, stag, skjøt, hjørner i
  rammen, duk og trykkfil) er de samme. En strek på en systemveggs linje monteres på veggen (på siden streken startet
  fra), en strek alle andre steder står på fotplater.
  *Bjørn 31.10.2026, 6.11.2026 og 7.11.2026 («frittstående er InFrame på fotplater») · kode `src/domain/textile/brush.ts` · test `src/domain/textile/brush.test.ts`*
- **X2 Ramme på systemvegg.** Bredde = spenn − 20 − 10 (sentrert i spennet), høyde 2540 eller tekstilens egen. 43TX gjæret,
  2B + 2H, 617 i alle fire hjørner, festet med 2 × 520 (med 503) til stolpe 94. Stående stag i 90 maks 2000 fra hverandre
  (rammesidene teller), lengde H − 80, med 600 i hver ende: duken trekker mest på midten.
  *Bjørn 31.10.2026 (fabric.js er fasit), stag 2 m 7.11.2026 · `rules.textile.inFrame`, `RECIPES.textileFrame` · kode `src/calc/textile/inFrame.ts` · test `src/calc/fabric.test.ts`*
- **X3 Trykkfil.** Ramme + 2 × bleed (20), levert i 10 %. Tilbudet lister trykkfilene kunden leverer, med filmål og
  filnavn, og trykklisten kan lastes ned som CSV der. Bleed, filskala og de andre målene for rammen endres under Regler på
  Kostgrunnlag og gjelder også kalkylen.
  *Bjørn 31.10.2026 · `rules.textile.inFrame` · kode `src/calc/textile/inFrame.ts` · test `src/calc/fabric.test.ts`*
- **X4 Plass på veggen.** InFrame står aldri over en åpning og overlapper ikke en annen på samme side. Standvegg har bare
  innsiden, innervegg og romvegg begge. To InFrame-rammer kobles ikke sammen.
  *Bjørn 30.10.2026 · kode `src/domain/textile/inFrame.ts` · test `src/domain/decor.test.ts`*
- **X5 På fotplater (frittstående).** Samme ramme som X2, på fotplater, med tekstil på begge sider (trykt, hvit eller kundens egen), høyde 2540, minst
  0,25 m. Tegnes med samme verktøy som veggen og disken (Bjørn 14.11.2026: ett tegneverktøy, alle pensler på samme
  grid): et klikk på gulvet setter 1 m, et drag vokser fra modulen du ser i hele meter, med Shift eller «Fin» er
  tegnestørrelsen 250 (som V1). Den kan stå overalt der volumet tillater det (F1, F2): langs en systemvegg, i T mot
  den, ende mot ende med den. Inntil en systemvegg uten å være montert står den bare der, den er ikke koblet (M1). Den
  lager ikke rom og kan ikke ha dør.
  *Bjørn 31.10.2026 og 21.11.2026 · `rules.textile` · kode `src/domain/textile/free.ts` · test `src/domain/textile/free.test.ts`*
- **X6 Skinner.** Gjelder rammen uansett montering. Topp- og bunnskinne går hele rammen; over 5000 skjøtes de i like stykker. Skjøten er 2 × 609 per
  skjøt (tres inn, krever plass i enden), eller 4 × 604 i sporet når begge ender er holdt av en vegg, en ramme på vegg
  eller en 92LTX, så profilen ikke kan tres. Stående 43TX i hver fri ende, 617 i hvert hjørne. En ramme på
  systemvegg settes sammen før den henges opp, så den skjøtes med 609.
  *Bjørn 31.10.2026, skjøt 7.11.2026 · `RECIPES.textileFrame` · kode `src/calc/textile/free.ts`, `src/calc/textile/inFrame.ts` · test `src/calc/freeFrames.test.ts`, `src/calc/fabric.test.ts`*
- **X7 Hjørne.** To frittstående vegger møtes bare ende mot ende i rett vinkel (ingen T) og deler en 92LTX, kappet
  2526 (endelokk 7 mm under og over, ikke plukket). Skinnene stopper 37 mm før hjørnepunktet; utvendig duk er 20 mm
  lengre og innvendig 20 mm kortere per hjørne. En strek i forlengelsen blir samme vegg. 43TX er gjæret i rammens
  hjørner; mot en 92LTX og i en skinneskjøt (X6) er enden butt. Plukklisten på arbeidsordren sier hvilke lengder som
  har butte ender.
  *Bjørn 31.10.2026, 6.11.2026 og 8.11.2026 · `RECIPES.textileFrame` · kode `src/calc/textile/free.ts`, `src/domain/textile/free.ts` · test `src/calc/freeFrames.test.ts`*
- **X8 Føtter og stag.** Fotplate 740 under bunnskinnen etter S3 og S4; en 92LTX teller som støtte. Stagene er rammens
  egne (som X2) og står uavhengig av føttene: en fotplate har ikke stag.
  En fot i en fri ende står i flukt med rammeenden (200 mm inn for 740), resten jevnt fordelt. Under 1 m: én 730 midt på.
  Ett stag 150 mm (100–200) fra hver side av en skinneskjøt, så det virker som rammeside når lange motiver monteres i
  seksjoner. Ellers jevnt fordelt, så ingen stående (rammeende, 92LTX, stag) står mer enn 2000 fra hverandre.
  *Bjørn 1.11.2026, 3.11.2026 og 7.11.2026 · `rules.textile.inFrame.stag`, `RECIPES.textileFrame.spliceBrace` · `RECIPES.textileFrame.feet.support` · kode `src/calc/textile/free.ts`, `src/calc/supports.ts` · test `src/calc/freeFrames.test.ts`*

- **X9 Standardlengder (veiledende).** Fordi systemveggene på messer er standardisert, har 43TX standardlengder som
  passer på veggene: cc − 30, det vil si 970, 1970, 2970 og så videre (X2). I tillegg finnes noen andre, som 470, og
  lengder for rammer som henger utenpå én enkelt vegg, med bruttomål over cc (for eksempel 1040). Standardlengder ligger
  på lager og plukkes bare; andre lengder må kappes og skal koste mer. En skjøtt lengde er som regel én standardlengde
  pluss ett kapp. Rammer på systemvegg bruker standardlengdene (X2). Frittstående tegnes fritt som før (X5), men appen
  kan foreslå en standardlengde for å spare penger. Mot en 92LTX kappes skinnen fortsatt (X7), til den får egen
  standard. Standard høyde er 2540; rammer kan skjøtes til om lag 5 m høyde.
  *Bjørn 6.11.2026 · ikke bygget: forslag om standardlengde, pris for kapp, andre standardlengder · kode `src/calc/textile/inFrame.ts` · test `src/calc/fabric.test.ts`*

- **X10 Rammer overlapper aldri.** To rammer på vegger i rett vinkel som ville tatt samme plass (et innvendig hjørne:
  begge står 20–60 mm ut fra veggen) overlapper ikke. Rammen på den lengste veggen blir stående (like lange: den langs
  x, i planen bakveggen). Den andre beholder standardlengden (X9) og flyttes én rammedybde, 40 mm, langs veggen bort
  fra hjørnet, så den står inntil den andre rammens flate. Rammene etter den på samme side flyttes like mye så langt de
  ellers ville overlappet. Går det forbi veggens ende eller en åpning, er det innenfor toleransen. En flyttet ramme går
  40 mm forbi stolpen, så en takdrager som hviler der heves (T13). Vil ikke kunden ha det, kan rammemålet settes kortere
  i veggskuffen; da blir det en kapplengde (X9).
  *Bjørn 6.11.2026 · ikke bygget: pris for kapp · `rules.textile.depth` · kode `src/calc/textile/placement.ts` · test `src/calc/textile/placement.test.ts`*
- **X11 Frittstående mot ramme.** En frittstående tekstilvegg som ender mot en systemvegg med ramme på den siden,
  stopper mot rammens flate (60 mm fra veggens senterlinje) og står ikke inntil systemveggen der. Den blir like mye
  kortere. Det er F1 for en ramme på vegg; uten ramme stopper den mot stolpene.
  *Bjørn 6.11.2026 · kode `src/calc/textile/placement.ts`, `src/calc/textile/free.ts` · test `src/calc/textile/placement.test.ts`*
- **X12 Endegrep på frittstående tekstilvegg.** En valgt frittstående tekstilvegg har grep på hver ende som ikke står i
  et 92LTX-hjørne, også en ende inntil en systemvegg (den står bare der, M1), i Velg og med Tekstil-pennen, som innervegger (V13): hele meter, 250 med Shift eller Fin, kontrollert som når den tegnes, og
  grunnen vises når det ikke går. InFrame-tekstil på systemvegg har ingen endegrep ennå.
  *Bjørn 14.11.2026, 15.11.2026 og 21.11.2026 · kode `src/domain/textile/free.ts`, `src/ui/plan/grips.ts` · test `src/domain/wallEnds.test.ts`*
- **X13 Av og på systemveggen.** Tekstilveggen er ett produkt uansett montering (X1). Montert på en systemvegg er den
  koblet til veggen, ikke et annet produkt (Bjørn 21.11.2026), så den tas av og settes på som andre koblinger:
  - *På:* dras en frittstående tekstilvegg parallelt med en systemvegg og kommer innenfor magneten (M4, 300 mm) av en
    flate den kan monteres på, tar magneten den, og planen sier «Slipp for å montere på veggen». Slippes den, monteres
    den på siden av veggen den står ved (rett på linjen: siden den kom fra), over det ledige spennet den dekker mest
    (X2, X4), som en strek langs veggen. Med Løsne eller Alt slipper den forbi magneten og kan stå fritt langs veggen
    (F2); bare rett på veggens linje monteres den da, for der kan den ikke stå fritt.
  - *Løsne:* samme «Løsne» i pillen som tar vegger fra hverandre (M5) gjør den frittstående der den står, rett foran
    veggen så nær fotplatene tillater (F2), like lang.
  - *Av:* dras en tekstilvegg på systemvegg ut forbi magneten på sin egen side, står den fritt på fotplater der den
    slippes, like lang; nærmere holder magneten den på veggen, og langs veggen flyttes den langs flaten.
  - Siden som vender ut beholder duk og motiv. Siden mot veggen huskes og kommer tilbake når den tas av igjen. En
    tekstilvegg i et 92LTX-hjørne (M1) monteres ikke alene, bare med Løsne (M5). På fotplater er høyden foreløpig 2540
    fra gulvet (X5): har den en annen høyde eller står høyere på veggen, sier en melding det.
  I skissen er alle tekstilvegger én liste med montering vegg eller fotplater; av og på veggen endres bare monteringen,
  og tekstilveggen beholder sin id (filversjon 6, versjon 5 leses inn).
  *Bjørn 20.11.2026 og 21.11.2026 · kode `src/domain/textile/mount.ts`, `src/domain/textile/mounts.ts`, `src/ui/plan/pointer/freeMove.ts`, `src/ui/plan/pointer/textileOff.ts`, `src/ui/plan/pill/wall.tsx` · test `src/domain/textile/mount.test.ts`, `src/domain/textile/mounts.test.ts`*

## M · Magnet og kobling

Felles for innervegger og frittstående tekstilvegger (Bjørn 20.11.2026, plan
[Magnetisme og kobling](https://claude.ai/artifact/4s5tA5NuNQjQkQV5AztFi2)). Bare det byggesystemet fester, er koblet;
ellers står delene bare ved hverandre (Bjørn 21.11.2026, [Fysiske regler](https://claude.ai/artifact/CY3w79LdPnavwrR6MVKXiB)).

- **M1 Hva som er koblet.** Bare det byggesystemet fester: to systemvegger der en ende står på den andre (et hjørne, en
  T, ende mot ende), to frittstående tekstilvegger i et 92LTX-hjørne (X7), og en tekstilvegg montert på en systemvegg
  (X13), som da er en del av veggen. En tekstilvegg som ender mot en systemvegg, eller en systemvegg som ender mot en
  tekstilvegg, står bare inntil: det finnes ikke beslag for den T-en (Bjørn 21.11.2026). Koblingen lagres ikke, den
  leses av hvor delene står (som V10). Delene som henger sammen slik, er en gruppe: vegger eller tekstilvegger, aldri
  begge. En gruppe vegger koblet til en vegg som står fast (standvegg eller romvegg), er forankret.
  *Bjørn 20.11.2026 og 21.11.2026 · kode `src/domain/joints.ts` · test `src/domain/joints.test.ts`*
- **M2 Gruppen flyttes som én ting.** Klikk og dra i en del av en gruppe som står fritt, flytter hele gruppen: to 1 m
  vegger koblet i et hjørne flyttes som et hjørne, et tekstilhjørne som et hjørne. Dører, folie, hyller og tekstil på
  veggene går med. Vegger flyttes i hele meter som en innervegg (V7), 250 med Shift eller Fin; tekstilvegger i
  tekstilens rutenett. Det som bare står inntil, blir stående. Kan en del ikke stå der (utenfor standen, inn på en
  standvegg, en vegg gjennom en tekstilvegg, F1), stopper draget ved siste sted som går.
  *Bjørn 20.11.2026 og 21.11.2026 · kode `src/domain/joints.ts`, `src/domain/edit.ts`, `src/ui/plan/pointer/freeMove.ts` · test `src/domain/joints.test.ts`, `src/domain/standWalls.test.ts`*
- **M3 Forankret gruppe.** Er en gruppe vegger koblet til en vegg som står fast, flyttes bare det du drar, og naboene
  tar det opp så koblingene holder: en innervegg flyttes sidelengs, og innervegger som ender på den (hjørne eller T)
  blir lengre eller kortere. Ingen del blir kortere enn sitt minste mål. En tekstilvegg er aldri forankret, for ingenting
  holder den til en vegg.
  *Bjørn 20.11.2026 og 21.11.2026 · kode `src/domain/joints.ts`, `src/domain/edit.ts` · test `src/domain/joints.test.ts`, `src/domain/standWalls.test.ts`*
- **M4 Magnet.** Magneten hjelper å treffe en kobling (M1), og er oppførsel i verktøyet, ikke en regel om hvor noe kan
  stå. Under draget hopper en ende av gruppen som står fritt, inn på en del den kan kobles til når den kommer innenfor
  300 mm på hver led, samme avstand som når diskene slås sammen: en veggende på en annen vegg, helst på enden (hjørne
  eller ende mot ende), ellers på linjen (T); en tekstilende på enden av en annen tekstilvegg (92LTX-hjørne); og en
  tekstilvegg parallelt med en veggflate monteres (X13). Den trekker aldri en vegg inn mot en tekstilvegg eller
  omvendt, og aldri slik at en vegg legger seg langs en annen. Står en ende allerede mot noe, hopper ingenting. Slippes
  den der, er de koblet (M1); mens den står der, sier planen «Slipp for å koble». Med Løsne eller Alt slipper den forbi.
  *Bjørn 20.11.2026 og 21.11.2026 · kode `src/domain/joints.ts`, `src/domain/edit.ts`, `src/domain/textile/mount.ts` · test `src/domain/joints.test.ts`*
- **M5 Løsne.** «Løsne» i pillen på en innervegg som er koblet til noe, og på enhver frittstående tekstilvegg, er en innstilling
  så lenge den er valgt: dra flytter da bare den, som om ingenting var koblet til, og hjørnet blir fri ende igjen. På PC
  gjør Alt + dra det samme, og begge slipper forbi magneten (M4). På en tekstilvegg montert på vegg tar «Løsne» den av
  veggen med en gang, så den står fritt foran veggen (X13).
  *Bjørn 20.11.2026 og 21.11.2026 · kode `src/domain/joints.ts`, `src/domain/edit.ts`, `src/ui/plan/pill/parts.tsx`, `src/ui/plan/pointer/select.ts` · test `src/domain/joints.test.ts`*
- **M6 Grep på vegger og tekstilvegger.** Innervegger og frittstående tekstilvegger har de samme grepene som disker,
  rom og møbler, i det felles grepsystemet: endegrep på frie ender (V13, X12), et hjørnegrep der to armer møtes, som
  flytter hjørnet så begge armene blir lengre eller kortere (resten som M3), og for en gruppe som står fritt et
  flyttegrep (fire piler, midt på delen som er valgt) og et rotergrep (ut fra hjørnet nede til høyre av boksen rundt
  gruppen) som snur hele gruppen 90° om midten, på 250-rasteret og innenfor standen. Dører, hyller, tekstil og
  platefarger følger veggene. Grepene virker i Velg, med Vegg- eller Tekstil-pennen og i 3D; flyttegrepet vises bare
  med pennen, i Velg er hele delen grepet. En forankret gruppe (M3) har ikke flytte- eller rotergrep. «Roter» i pillen
  på en frittstående tekstilvegg snur gruppen den er i.
  *Bjørn 20.11.2026 · kode `src/domain/groupGrips.ts`, `src/ui/plan/grips.ts`, `src/domain/plateDecor.ts` · test `src/domain/groupGrips.test.ts`*

## F · Fysisk volum

Reglene bygger på byggesystemet og fysikken, ikke på forbud (Bjørn 21.11.2026: «Jeg vil at vi skal bygge regler
basert på byggesystem og fysiske lover, ikke kunstige begrensinger»). Tegneverktøyet gir byggeklosser som settes
sammen der byggesystemet kan feste dem (M1), og ellers bare står plassert ved hverandre.

- **F1 Fysisk volum.** Hver del tar plass: en systemvegg 20 mm dyp mellom stolpene (skinne 92 og 91 med plate) og
  40 mm ved stolpe 94, en tekstilramme 40 mm. Der to volum ville overlappe, kan delene ikke stå, og pennen, grepet
  eller draget stopper og sier hvorfor; inntil hverandre er lov. En frittstående tekstilvegg som ender mot en
  systemvegg, stopper mot stolpenes flate, 20 mm fra veggens linje (mot en ramme på veggen: X11), og blir like mye
  kortere. Planen tegner den der den står, som kalkylen. Ikke bygget: disker, podier og møbler mot tekstilvegger.
  *Bjørn 21.11.2026 · `RECIPES.wall.post`, `rules.textile.depth` · kode `src/domain/textile/free.ts`, `src/calc/textile/placement.ts` · test `src/domain/textile/free.test.ts`, `src/calc/textile/placement.test.ts`*
- **F2 Fotplater og justeringsføtter.** På gulvet tar justeringsfoten under en stolpe 40 × 40. En frittstående
  tekstilveggs fotplater (740, 400 × 400, toveis med skruehull i senter, eller 730) ligger utenfor føttene, ikke inne
  mellom dem under veggen: parallelt med en systemvegg står rammen minst en halv fotplate pluss en halv fot ut fra
  veggens linje (220 mm med 740, 170 med 730). Nærmere monteres den på veggen (X13). Enveis fotplater finnes om det
  trengs senere. Ikke bygget: fotplater mot støtteplate 750 og mot fotplater under en annen tekstilvegg.
  *Bjørn 21.11.2026 · `RECIPES.wall.footprint`, `RECIPES.textileFrame.feet` · kode `src/domain/textile/free.ts`, `src/domain/textile/mount.ts` · test `src/domain/textile/free.test.ts`, `src/domain/textile/mount.test.ts`*

## G · Gulv

- **G1 Teppefliser.** Legges i rutenettet på 0,5 m: 1 × 1 som standard, 1 × 0,5 og 0,5 × 0,5. En flis kan starte i
  hvilken som helst celle, og fliser overlapper aldri. Plukkes per størrelse og farge.
  *Bjørn 1.11.2026 · `rules.floor.cell` · kode `src/domain/floor/tiles.ts` · test `src/domain/floor/floor.test.ts`*
- **G2 Auto og fast størrelse.** Auto legger 1 × 1 der den passer, ellers den største flisen som passer, og kutter aldri.
  En fast størrelse dekker det som ligger der og kutter fliser som bare delvis dekkes.
  *Bjørn 1.11.2026 · kode `src/domain/floor/brush.ts` · test `src/domain/floor/floor.test.ts`*
- **G3 Engangsteppe.** Legges i baner fra en rull 2 m bred, lengde i 0,5 m, langs standens lengste side som standard
  (kan snus). Siste bane kappes på langs. 10 cm ekstra i hver ende; avkappet er alltid svinn. Kunden betaler lagte m²,
  plukklisten har løpemeter fra rullen og teip langs omriss og skjøter.
  *Bjørn 1.11.2026 · `rules.floor.rollEnd`, katalogens `roll` · kode `src/domain/floor/lanes.ts` · test `src/domain/floor/floor.test.ts`*
- **G4 Fyll.** Fyll foreslår hvordan rullen kappes og legges over et område, rangert etter intern kost (materiale, teip,
  arbeid; satsene er forslag). Arbeidet regnes med montørens timekost, samme som for Foga, tekstil og møbler (Bjørn
  7.11.2026). Deling på langs finnes bare som forslag fra Fyll. Gulvpennen for engangsteppe er én malerkost (Bjørn
  11.11.2026, Bane er fjernet): dra et område, klikk ledig gulv for å fylle alt ledig gulv, eller klikk en bane for å
  gi den pennens farge; spannet fyller hele standen. Retning og andre legginger velges i skuffen eller med R på en bane.
  *Bjørn 1.11.2026 · kostgrunnlaget `parametere.carpet`, timekost fra `parametere.labour` (`pricing.carpet`) · kode `src/domain/floor/rollFill.ts` · test `src/domain/floor/rollFill.test.ts`*
- **G5 Under rom og vegger.** Gulvet legges under rom og vegger.
  *Bjørn 1.11.2026 · kode `src/domain/floor/lanes.ts` · test `src/domain/floor/floor.test.ts`*

## H · Hylle

- **H1 Hylle i veggfelt.** Rett hylle 6311, d 30 cm: én hylleplate melamin hvit 18 × 300 × 976 i ett veggfelt mellom to
  stolper 94 (1000 c/c), på en side av veggen som kan ta dekor. Platen ligger inn i det innvendige hjørnet på stolpen og
  kjøpes ikke hos Foga. Hyller tegnes med eget verktøy og flere kan stå over hverandre i samme felt.
  *Bjørn 8.11.2026 · `RECIPES.shelf.board`, `rules.shelf.board` · kode `src/domain/fittings.ts`, `src/domain/shelves/model.ts`, `src/foga/recipes.ts` · test `src/domain/shelves/shelves.test.ts`*
- **H2 Knekter i rad.** Hver hylle står på én knekt i hver av sine to stolper. Står to hyller i nabofelt på samme side og
  i samme høyde, deler de én 91FF (dobbel flens) i stolpen mellom seg; alle andre knekter er 91F (én flens). En rad på
  n hyller er n plater, 2 × 91F og (n − 1) × 91FF.
  *Bjørn 8.11.2026 · `RECIPES.shelf.end`, `twin` · kode `src/domain/shelves/brackets.ts`, `src/foga/engine.ts`, `src/calc/lines/shelves.ts` · test `src/calc/shelves.test.ts`*
- **H3 Knekt.** 91F (873 043 22) og 91FF (873 044 22) kappes 290 mm og festes med én 600 inn i stolpens kanal. Plukkes
  som ferdig enhet, knekt med 600.
  *Bjørn 8.11.2026 · `RECIPES.shelf.bracket`, `coupling` · kode `src/foga/engine.ts`, `src/foga/recipes.ts` · test `src/calc/shelves.test.ts`*
- **H4 Høyde.** Hyllens høyde er overkant plate fra gulv, i trinn på 50 mm, fra 100 til 2400 mm. Over 2100 mm er lov, men
  med advarsel: varer kan ikke settes synlig over toppen av standveggen. En ny hylle får 1300 mm, eller høyden til en
  hylle ved siden av, så raden fortsetter (H2). Hurtigvalg 500, 900, 1300, 1700 og 2100 mm (100 er laveste mulige, ikke
  en vanlig plassering). Hyller legges til i én og samme rekkefølge, i et felt («Hylle til i feltet», Rad til, Shift på
  hyllepensla) og på hele veggen («+ Hylle», «+ Hyllerad»): neste hurtigvalg over, så under, så 100 mm, så feltet har
  jevne ca. 400 mm; først deretter midt i største ledige mellomrom.
  *Bjørn 8.11.2026, endret 9.11.2026 · `rules.shelf.min`, `max`, `high`, `step`, `heights`, `start` · kode `src/domain/shelves/model.ts` · test `src/domain/shelves/shelves.test.ts`*
- **H5 Lysmål.** Minst 100 mm lysmål mellom hyller over hverandre i samme felt, fra overkant nedre plate til underkant
  øvre. Veggrisset viser lysmålet, så kunden ser om utstyret får plass.
  *Bjørn 8.11.2026 · `rules.shelf.gap` · kode `src/domain/shelves/model.ts` · test `src/domain/shelves/shelves.test.ts`*
- **H6 Hvor hyller kan stå.** Ikke i dørfelt eller åpning, ikke der en tekstilvegg dekker feltet eller holder stolpen,
  ikke på frittstående tekstil (43TX er ikke 94). Hver stolpe må ha ledig kanal mot hyllens side, eller være et
  innvendig hjørne (H9): går en annen vegg ut fra stolpen mot den siden, står hyllen i hjørnet på 01-skinne. Foran print
  og dekal er lov. Heng skal stå bare mellom stolper med ledig kanal (heng er ikke bygget ennå).
  *Bjørn 8.11.2026, endret 10.11.2026 · kode `src/domain/fittings.ts`, `src/domain/shelves/corners.ts` · test `src/domain/shelves/shelves.test.ts`, `src/domain/shelves/corners.test.ts`*
- **H7 Pris per hylle.** Samme pris per hylle alene og i rad, som systemvegg (fast katalogpris; kostmotoren gir kost og
  tid). Direkte tid 1,5 min opp og 1 min ned per hylle, også i hjørner. Indirekte tid per ordre kommer i tillegg:
  vareplukk 10 min én gang per ordre med hyller, og gange 20 min til og fra montering (på arbeidsordren) og 20
  til og fra demontering, én gang per ordre for alle produkter (`gange-montering`, `gange-demontering`). Stolpene er en del av
  veggen: bare plukklisten bryter ut knekter, skinner, 600 og plater.
  *Bjørn 8.11.2026, endret 10.11.2026 · `EXAMPLE_TIMES` (`montering-hylle`, `vareplukk-hyller`) · kode `src/calc/lines/shelves.ts` · test `src/calc/shelves.test.ts`*
- **H8 Veggriss med hyller.** Arbeidsordren har et veggriss for hver veggside med hyller: hyllene målsatt fra gulv
  (overkant plate) og lysmålet mellom hyller over hverandre, med modulkjeden c/c under veggen. Veggskuffen viser det
  samme. Tilbudet viser hyller bare i 3D, uten veggriss. I et hjørne viser veggrisset 01-skinnene på
  veggen, og under det står hvert hjørne for seg: skinnens lengde, senter fra hjørnestolpen og hva den bærer, og hvilke
  hyller som får tilpasset plate (H10–H12). En veggside som bare har en skinne for en hjørnehylle på den andre veggen,
  får også veggriss.
  *Bjørn 8.11.2026, endret 10.11.2026 · kode `src/ui/workorder/ShelfElevation.tsx`, `src/ui/plan/wallDrawer/elevationMeasure.ts`, `src/domain/shelves/model.ts` · test `src/ui/plan/wallDrawer/elevationMeasure.test.ts`, `src/domain/shelves/shelves.test.ts`, `src/domain/shelves/corners.test.ts`*

- **H9 Hylle i hjørne.** Et innvendig systemhjørne er likt uansett hvor det står: i enden av en vegg eller i et T-kryss
  (der er det to hjørner, ett på hver side av veggen som går ut). Hjørnefeltet er feltet ved hjørnestolpen; stolpens
  kanal mot hyllen brukes av den andre veggen, så hjørneenden av hyllen står på en 01-skinne på den andre veggens
  hjørnefelt (H12), og det feltet må kunne ta den (ikke åpning eller dør, ikke dekket av tekstil). To hyller i samme høyde
  i hjørnets to felt møtes (H11), alle andre der står alene (H10). Hyller i de to hjørnefeltene holder lysmålet i H5 også
  på tvers av hjørnet, ellers treffer platene hverandre. Et felt med hjørne i begge ender (1 m mellom to vegger) kommer
  senere. Samme artikkel 6311 og pris per hylle som ellers (H7); forskjellene står på plukklisten og arbeidsordren.
  *Bjørn 10.11.2026 · `RECIPES.shelf.corner` · kode `src/domain/shelves/corners.ts`, `src/domain/shelves/model.ts` · test `src/domain/shelves/corners.test.ts`*
- **H10 Hjørnehylle alene.** Hjørne hylleplate 960 × 300 på hjørnefeltet. Ved hjørnet ligger platen oppå en 91 kappet
  80 mm (uten flens) i en 01-skinne på den andre veggen, 200 mm ut fra hjørnestolpen til skinnens senter, med 4,5 mm
  klaring fra plateenden til skinnen. Skinnen skal stå minst 50 mm innenfor platens forkant, så hyllen ikke skyves av. I
  den andre enden står en vanlig knekt (H2).
  *Bjørn 10.11.2026 · `RECIPES.shelf.corner` (`short`, `single`, `boards.corner`) · kode `src/domain/shelves/corners.ts`, `src/domain/shelves/brackets.ts`, `src/foga/engine.ts`, `src/calc/lines/shelves.ts` · test `src/domain/shelves/corners.test.ts`*
- **H11 Hyller som møtes i hjørnet.** Veggen som er tegnet først får hjørne hylleplate 960 × 300, veggen som er tegnet
  sist 2/3 hylleplate 655 × 300 og 01-skinnen. Skinnen står rett foran hjørneplatens forkant (1 mm klaring), med en 91FF
  290 mm: én flens bærer hjørneplatens forkant, den andre enden av 2/3-platen (2 mm klaring). I de ytre stolpene står
  vanlige knekter (H2).
  *Bjørn 10.11.2026 · `RECIPES.shelf.corner` (`play`, `boards.twoThirds`) · kode `src/domain/shelves/corners.ts`, `src/domain/shelves/brackets.ts`, `src/calc/lines/shelves.ts` · test `src/domain/shelves/corners.test.ts`*
- **H12 01-skinne i hjørnet.** 01 (873 001 22) henger fra toppskinnen 92 med en 01-kanal-krok og plukkes som enhet med
  kroken. Skinnen finnes i én lengde per hurtigvalg i H4 og laveste høyde, fra veggens topp ned under knekten til en
  hylle der (490, 890, 1290, 1690, 2090 og 2490 mm); den korteste som rekker ned under den laveste knekten den bærer
  brukes. Alle hyller av samme slag i ett hjørnefelt deler skinne: én for hyller alene og én for hyller som møtes, to når
  de blandes (en hylle alene på 91FF har ingenting som holder skinnen, så den svinger ut). Går en skinne fra den andre
  veggen bak en hjørne hylleplate, blir platen smal, 960 × 290: forkanten står der den alltid gjør, og skinnen har nok
  gi til de 1,5 mm som mangler.
  *Bjørn 10.11.2026 · `RECIPES.shelf.corner` (`rail`, `hook`, `boards.narrow`), `railLengths` · kode `src/domain/shelves/corners.ts`, `src/domain/shelves/brackets.ts`, `src/foga/engine.ts`, `src/cost/itemDefs.ts` · test `src/domain/shelves/corners.test.ts`, `src/calc/shelves.test.ts`*

## K · Disk

Alle disker og podier tegnes i Disker og podier (tast D) og bygges etter de samme reglene. K1–K6 beskriver bygget, med
Bardisk 6560 som mønster, K7–K12 mål, seksjoner og høyde, K13 pris og plukk, K14–K20 det man gjør med en disk som står,
K22 standardvarene og K23 disker over en fotplate.

- **K1 Bardisk 6560.** Disken på lager er 1020 × 520 × 1040 mm utvendig: én kasse av Foga-profiler, lukket foran og i
  begge ender, åpen bak der standpersonalet står. Den kommer ferdig montert og plukkes som 1 stk så lenge lageret rekker.
  I tilbudet er den én linje per stk til fast pris (1320 kr); kalkylen regner kost og tid fra det den er bygget av
  (K2–K5). Den er et ferdig oppsett i Disker og podier (K22); andre lengder og fasonger bygges på stedet (K10–K13).
  *Bjørn 11.11.2026 · `RECIPES.counter.stock` · kode `src/foga/recipes.ts`, `src/catalog/defaultCatalog.ts`, `src/calc/lines/objects.ts`, `src/cost/itemDefs.ts` · test `src/foga/counter.test.ts`, `src/calc/counter.test.ts`*
- **K2 Hjørnestolpe.** 92L (873 050 22, 30 × 30, kanal på de to innersidene) i hvert hjørne, hele høyden 1040 mm, med de
  lukkede sidene ut. Disken står rett på gulvet uten justeringsfot, så disker kan settes helt inntil hverandre. Over en
  fotplate står den på innsats 700 (K23).
  *Bjørn 11.11.2026 · `RECIPES.counter.post`, `height`, `postSize` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K3 Skinner.** 93 (873 060 22, 30 × 40, kanal i begge ender og på innsiden) rundt alle fire sidene i midten (750–790)
  og øverst (1000–1040), og 92 på gulvet foran og i begge ender; bak er det ingen bunnskinne. Skinnene står mellom
  stolpene: sidens lengde − 2 × 30, altså 960 og 460. Én 600 i hver skinneende, 22 per disk.
  *Bjørn 11.11.2026 · `RECIPES.counter.rail`, `bottomRail`, `middle`, `top`, `coupling` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K4 Plater.** Samme veggplate som systemveggen (V5, 3 mm) i kanalene foran og i begge ender, delt ved midtskinnen:
  976 × 726 og 976 × 226 foran, 476 × 726 og 476 × 226 i hver ende. Platen går ned i kanalen og står 2 mm kort i hver ende og 4 mm kort i toppen. Farge står i K6, print og dekal i K20.
  *Bjørn 11.11.2026 · `RECIPES.counter.plate`, `channel`, `platePlay` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K5 Topp og hylle.** MDF malingsmelamin Fibraplast H Barnizable hvit/hvit 6 mm, 976 × 476, ikke Foga. Toppen ligger i
  falsen på den øverste 93 (1030–1036, 4 mm under skinnens overkant), hyllen i falsen på den midterste (780–786). Platen
  står 2 mm fra skinnens kropp på alle sider.
  *Bjørn 11.11.2026 · `RECIPES.counter.board`, `boardPlay` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K6 Farge på disken.** Platene er veggplater i veggfargene (RAL som systemveggen). Disken har en farge, og hver plate
  kan få sin egen (Bjørn 18.11.2026): en plate er én lysåpning i en del, under, mellom eller over hyllene, og en
  skyvedør er én flate med begge bladene. Disken på lager er hvit 9010; en plate i en annen farge byttes på lageret før
  messen og tilbake etter. Prisen er den samme i alle farger (1320 kr), kalkylen tar med platebyttet per plate som
  byttes (prisartikkelen platebytte bardisk, per plate), og linjen sier hvilke farger montøren skal ha med. En disk
  bygget på stedet kuttes av veggplater i fargen, uten tillegg. Farge og print følger plateregelen (V15, V16). Fargen
  følger ikke veggenes standardfarge, og spannet på veggene farger ikke diskene: Disker og podier har sitt eget spann.
  *Bjørn 11.11.2026, 18.11.2026 · `RECIPES.counter.stock.ral`, `SectionSide.ral` · kode `src/domain/paint.ts`, `src/domain/podiumFaces.ts`, `src/foga/counter.ts`, `src/calc/lines/objects.ts`, `src/cost/itemDefs.ts` · test `src/calc/counter.test.ts`, `src/domain/paint.test.ts`*
- **K7 Mål.** Knutepunktene står på et raster på 250 mm: en seksjon er 250, 500, 750 eller 1000 c/c i hver retning. En
  lengde deles i hele meter først og resten sist, regnet fra seksjonen man startet i (1520 = 1000 + 500, 1750 =
  1000 + 750). Knutepunktet står 10 mm inn fra ytterflaten, så utvendig er c/c + 20 (270, 520, 770, 1020), skinnene
  c/c − 40 (210, 460, 710, 960), og platene og toppene c/c − 24 (226, 476, 726, 976).
  *Bjørn 12.11.2026, 13.11.2026 · `RECIPES.counter.module`, `face`, `joint` · kode `src/foga/counter.ts`, `src/domain/counterShape.ts` · test `src/foga/counter.test.ts`, `src/domain/podiumStock.test.ts`*
- **K8 Knutepunkt.** Profilen som står i et knutepunkt, velges etter retningene den kobler: to i L gir 92L, tre i T gir
  93, fire i kors gir 94. Skinnene blir like lange uansett profil; bare antall retninger profilen kan kobles i er
  forskjellig. En skjøt i en rett disk er derfor en 93 foran og en bak, og en L av 500 × 500 med to ben på 1000 har 94 i
  innerhjørnet. **I planen** har disken ett omriss rundt hele seg, innenfor ytterkanten: hel strek der den er lukket og en
  tynn, lys hårstrek der den er åpen (Bjørn 13.11.2026: stiplet i planen hører til gangside og takdrager, og uten strek
  forsvinner en hvit disk på hvitt gulv). En tynn delelinje går på tvers av disken der to seksjoner møtes, over
  94-skinnen mellom dem. Valgt disk viser utvendig helmål: bredde og dybde på siden mot midten av standen, en L sine to
  ytre lengder. Arbeidsordren viser helmålene på alle disker som bygges på stedet; en standardvare (K22) får ingen.
  *Bjørn 12.11.2026 · `RECIPES.counter.nodes`, `innerRail` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K9 Tid for disk bygget på stedet.** Plassholder til Bjørn har målt: 26 min i alt per hel meter (plukk, vask og
  transport 2 + 2 + 2, montering 13, demontering 7), halvparten per halv meter (1 + 1 + 1, 6, 4) og 6 til per hjørne
  (4, 2), så en disk på 1,0 m bygget på stedet koster omtrent 1320 som 6560 (20–30 min på 1 m, Bjørn). Tiden er lik i
  alle farger. Hvordan den telles per seksjon, står i K13.
  *Bjørn 12.11.2026 (tid forslag) · `ITEM.counterProfile`, `counterWhole`, `counterHalf`, `counterCorner` · kode `src/calc/lines/objects.ts`, `src/cost/itemDefs.ts`, `src/foga/counter.ts`, `src/foga/engine.ts`, `src/domain/counters.ts` · test `src/calc/podium.test.ts`*
- **K10 Seksjoner og pennen.** En disk eller et podie er satt sammen av seksjoner (K7), med et knutepunkt i hvert hjørne
  av hver seksjon.
  **Fasong:** fri så lenge seksjonene henger sammen langs en kant på minst 250; alle fasonger går, også L, T og kors.
  **Plassering:** knutepunktlinjene står på hele 5 cm i standen (Bjørn 16.11.2026), når disken settes, tegnes og
  flyttes. Innen 10 cm fra en vegg, en disk eller standkanten legger magneten den inntil, også når den flyttes; ved
  standkanten står den alltid inntil. Ytterflaten er diskens virkelige mål: den går aldri inn i en vegg eller en annen
  disk, og mot en standvegg står den mot veggens flate. En stolpe som står fritt på gulvet under en takdrager (T12), også
  de som følger standveggene, er i veien som en vegg, for disker og møbler (Bjørn 16.11.2026). Der den ikke får plass,
  nektes den med «Ikke plass til disken her».
  **Tegne:** med «Fri» i hurtigvalget (K22) viser pennen én seksjon 500 × 500 dempet midt under pekeren, og ingenting
  over en disk; et klikk lagrer den, et klikk på en disk velger den. Trykk og dra tegner videre fra seksjonen, som står
  fast fra trykket: i hver retning for seg vokser disken `round(d / 500) × 500` når pekeren går `d` forbi kanten, inne i
  seksjonen skjer ingenting, og begge retninger gir et rektangel.
  **Shift og Fin:** Shift bytter tegnestørrelsen til 250 (Bjørn 14.11.2026), både for seksjonen under pekeren og for
  draget. Holdes Shift inne underveis i et drag startet uten, følger kanten nærmest pekeren i 250-steg, som et
  hjørnegrep; slippes Shift, vokser det igjen i 500. Tastetrykket alene endrer aldri størrelsen. «Fin» i hurtigvalget
  gjør det samme som Shift for berøring.
  **Påbygg:** innen 300 mm utenfor en side av en disk legger seksjonen seg inntil siden i diskens raster. Den glir langs
  siden i 500-steg fra sidens ende (250 med Shift eller Fin) og stikker høyst 250 utenfor enden. Klikk og drag tegner
  som over, men kanten mot disken står fast. Påbygget blir en del av disken: én disk, én linje, diskens farge, og høyden
  til seksjonen det ligger mot. Nektes med «Disken kan ikke gå over seg selv», «En del ville stått løst» (mindre enn 250
  felles med siden) eller «Ikke plass til disken her». Pillen viser påbygget c/c og disken utvendig etterpå:
  «+ 500 × 500 · 2 020 × 1 020».
  *Bjørn 13.11.2026 · kode `src/domain/podiums.ts`, `src/domain/counterShape.ts`, `src/domain/types.ts`, `src/domain/objects.ts`, `src/ui/env.ts` · test `src/domain/podiums.test.ts`*
- **K11 Tett bygg.** Alle utvendige sider er tette: bunnskinne 92 og toppskinne 93 på hver utvendig kant, og én
  veggplate i hele høyden i kanalene, mellom bunnskinne og toppskinne. Det er ingen midtskinne og ingen hylle i
  grunnbygget; hyller står på egne skinner (K19). Inne i disken står ingen plater og ingen bunnskinne; mellom to
  seksjoner går en 94 øverst som bærer toppen fra begge sider. Hver seksjon har sin topp, MDF 6 mm som K5, også på
  podier.
  *Bjørn 13.11.2026 · kode `src/foga/counter.ts`, `src/domain/counterShape.ts` · test `src/domain/podiums.test.ts`*
- **K12 Høyde.** CC 250, 500, 750 eller 1000: toppskinnen står med underkant i den høyden, stolpen er CC + 40 (290,
  540, 790, 1040), og platen CC − 24 høy. Høyden lagres per seksjon. Høyden i hurtigvalget (1000 til noe er valgt) gir
  høyden alt i ett drag tegnes med; et påbygg arver høyden til seksjonen det ligger mot, og høyden på en seksjon som
  står, endres etter K18. Der to seksjoner med ulik høyde møtes, står en 94 under den lave toppen og en 93 i den høyes
  høyde mot den lave siden, og trinnet lukkes med en plate mellom dem, høydeforskjellen − 24 høy; stolpene der går til
  den høye. **Visning (Bjørn 15.11.2026):** CC vises aldri, fordi det er vanskelig å måle på stedet. Et valg
  (hurtigvalget, skuffen, grepene i risset, også hyllene i K19) heter etter trinnet, «25 / 50 / 75 / 100 cm». Et mål
  (pille, tilbud, risset og arbeidsordren) er fra gulvet til toppen av skinnen, CC + 40: «H 540», og «540/1040» når
  disken har flere høyder (`heightName`, `outerHeight`).
  *Bjørn 13.11.2026 · kode `src/foga/counter.ts`, `src/domain/podiums.ts`, `src/ui/plan/quick/podium.tsx` · test `src/domain/podiums.test.ts`*
- **K13 Pris og plukk for Disker og podier.** Ett katalogprodukt per funksjon for det som bygges på stedet: «Disk»
  (6571) under Disker og «Podie» (6572) under Podier (varenumrene er midlertidige). Hver er priset av kostmotoren fra
  delene og arbeidet, likt i alle farger, én linje per disk eller podie, «bygget på stedet L × D × H mm», og delene
  plukkes løse under Disker. Alle navn hentes fra produktlisten (Bjørn 14.11.2026): linjen, pillen, skuffen,
  arbeidsordren og hurtigvalget heter det produktet heter. Det som tegnes med «Disk» i hånden, er en disk, og med
  «Podie» et podie. Det «Fri» tegner, er standardvaren det er (K22) sin funksjon, ellers en disk når fasongen ikke er
  dypere enn 500 noe sted (ingen 750 × 750 får plass i den), ellers et podie; det bestemmes når det tegnes, og et påbygg
  beholder sitt. Toppene har prisartikler
  for alle målene i K7. Tid (K9): `counterWhole` per seksjon med lengste side over 500, `counterHalf` per seksjon
  ellers, `counterCorner` per innvendig hjørne i omrisset.
  *Bjørn 13.11.2026 · `ITEM.counterBoard`, `counterWhole`, `counterHalf`, `counterCorner` · kode `src/calc/lines/objects.ts`, `src/cost/itemDefs.ts`, `src/catalog/defaultCatalog.ts`, `src/catalog/podium.ts`, `src/domain/podiums.ts`, `src/ui/podiumPen.ts` · test `src/calc/podium.test.ts`, `src/domain/podiums.test.ts`, `src/ui/podiumPen.test.ts`*
- **K14 Grep på valgt disk.** En valgt disk viser grep som i et CAD-verktøy, i Velg og med pennen: ett midt på hver
  rette side av omrisset (hele siden, også over flere seksjoner) og ett i hvert hjørne av boksen rundt (flytter de to
  sidene av boksen som møtes der). **Flytt:** et flyttegrep (rundt, fire piler) står på disken så langt fra lenker og
  andre grep som det går og flytter hele disken, også med pennen (Bjørn 15.11.2026); et klikk på det gjør ingenting. I
  Velg vises det ikke: der er hele disken et flyttegrep. **Roter:** et rotergrep (rund pil) ut fra boksens nedre høyre
  hjørne dreier disken om midten i 90°-steg, siden sider, skjøter og standardform følger standens linjer. Et valgt møbel
  har rotergrepet også (ikke et rundt møbel alene), i 90°-steg og 15° med Shift eller Fin, og står det i veien, dreies
  det så langt det går. **Kantgrep:** flytter kanten i 500-steg, 250 med Shift eller Fin. Ut: seksjonen ved siden
  strekkes til 1000 før en ny legges til (K7); en seksjon som bare delvis ligger langs siden, strekkes ikke, det legges en
  ny ved siden av. Inn: seksjoner krympes og fjernes, vist med skravur før slipp; to seksjoner som da får plass i én
  (samme spenn, høyde, hyller og valg på sidene, til sammen høyst 1000), blir én. Minste disk er 250 × 250. Nektes med
  «En del ville stått løst», «Disken kan ikke gå over seg selv» eller «Ikke plass til disken her».
  *Bjørn 13.11.2026 · kode `src/domain/podiumGrips.ts` · test `src/domain/podiumGrips.test.ts`*
- **K15 Fusjon og lenker.** En disk som dras med Velg innen 300 mm fra en annen, legger seg inntil den, flate mot flate,
  med knutepunktene i dens raster og minst 250 felles langs siden. Ved slipp blir de én disk: den som sto stille,
  beholder fargen og plassen, og den som ble dratt, legges på dens knutepunktlinje (20 mm inn, de to flatene blir én
  skjøt). Med «Disk» eller «Podie» i hånden er det det samme (Bjørn 16.11.2026): et klikk eller drag som ender innen
  300 mm fra en annen disk, eller går inntil 250 inn i den, legger seg inntil og blir en del av den, vist før slipp.
  Hver seksjon beholder sin høyde, sine hyller og sine åpne sider, og trinnet bygges etter K12. **Lenker:** en skjøt er
  en rett linje inne i disken der seksjoner møtes; valgt disk viser et lenkeikon midt på hver skjøt. Et klikk bryter
  lenken: den største delen blir stående, de andre blir egne disker med samme farge, flyttet 20 mm ut slik at de står
  flate mot flate. Deler ikke skjøten disken alene: «Skjøten deler ikke disken alene: bryt også skjøten ved siden av».
  Mot en disk som står inntil, vises en brutt lenke, og et klikk lenker dem. To disker inntil hverandre uten lenke er
  to linjer i tilbudet og har plater mot hverandre.
  *Bjørn 13.11.2026 · kode `src/domain/podiumLinks.ts`, `src/ui/plan/pointer/podium.ts` · test `src/domain/podiumLinks.test.ts`*
- **K16 Sider og lysåpninger.** Hver del av omrisset, mellom to knutepunkter, hører til seksjonen bak og er delt i
  lysåpninger av hylleskinnene i seksjonen (K19): en under den nederste skinnen og en over hver; uten hyller er delen én
  lysåpning. Hver lysåpning er plate, åpen eller skyvedør (K17). Plate er standard (K11) og lagres ikke; platen går fra
  skinnen under til skinnen over. Åpen: ingen plate, og ingen bunnskinne når det er den nederste lysåpningen (som
  baksiden på 6560); de andre skinnene og stolpene står. Trinnplaten (K12) er alltid plate. **Valget** gjøres i skuffen:
  med hele siden eller en del valgt gjelder det alle lysåpningene i den, et klikk på én lysåpning i risset velger bare
  den. En ny hylle deler en lysåpning i to som begge beholder valget, og en hylle som tas bort slår de to sammen til den
  nederste, som beholder sitt. Valget lagres på seksjonens side, så det følger delen: flytt og roter endrer ingenting,
  et grep som strekker en seksjon strekker valget med, en ny del er plate, og en side som blir innvendig (påbygg, fusjon)
  mister valget. Valget gjelder også mot en vegg eller en annen disk (Bjørn 16.11.2026: siden er utilgjengelig uansett,
  og montøren slipper å bygge om). **Vises:** i planen er en del som er åpen i hele høyden en tynn, lys hårstrek (K8), og
  en del med skyvedør hel strek med dørstreker. Tilbudet sier hvor mange sider som har en åpen lysåpning: «1 åpen side».
  Arbeidsordren tegner hver side som har annet enn plate, hyller bak seg, eller print eller dekal, sett utenfra og
  målsatt som i skuffen («Disker sett utenfra»).
  *Bjørn 13.11.2026 · kode `src/domain/podiumFaces.ts` · test `src/domain/podiumFaces.test.ts`*
- **K17 Skyvedør.** To plater i sporet i skinnen under og skinnen over lysåpningen, i stedet for én plate, like høye som
  platen ville vært. Hver dør er lysåpningen / 2 + 10 (overlapp) + 10 (skinnespor) bred: 500 i lysåpning 960, 375 i 710
  og 250 i 460. En dør skjøvet helt inn i sporet går da fortsatt 10 forbi midten. Den andre døren står rett innenfor den
  første, så de glir forbi hverandre. Skinnene står, også bunnskinnen. Ikke på deler på 250: «Skyvedør går ikke på en
  del på 250». Lås er ikke bygget. Tid, plassholder: 2 min opp og 1 ned per skyvedør (Bjørn 13.11.2026). Tilbudet sier
  «1 skyvedør», én per lysåpning med dør.
  *Bjørn 13.11.2026 · kode `src/foga/counter.ts` (`doorLeaves`), `src/domain/podiumFaces.ts` (`takesDoor`) · test `src/domain/podiumFaces.test.ts`, `src/calc/podium.test.ts`*
- **K18 Høyde per seksjon.** Høyden på en seksjon som står, endres i skuffen eller ved å dra toppen av seksjonen i
  risset (grepet «75 cm») eller i 3D (de øverste 80 mm av seksjonen, pekeren viser ↕); draget snapper til de fire
  høydene i K12, vises mens det dras og settes når det slippes. I 3D regnes draget fra skissen ved trykket, så hyller en
  lavere høyde tok bort, kommer tilbake om toppen dras opp igjen før slipp. Valget på delene (K16, K17) står. Hyller i
  eller over den nye høyden fjernes, og hintet i skuffen sier hvor mange.
  *Bjørn 13.11.2026 · kode `src/domain/podiums.ts` (`setSectionHeight`), `src/ui/plan/podiumDrawer/PodiumElevation.tsx`, `src/ui/scene3d/pointer/drag.ts` (`podiumTopAt`) · test `src/domain/podiumFaces.test.ts`, `src/ui/scene3d/pointer/drag.test.ts`*
- **K19 Hylle i disk.** En hylle hører til en seksjon og står i CC 250, 500 eller 750, lavere enn seksjonens høyde;
  det er ingen fri høyde. Bygget som midtskinnen i 6560 (K3, K5): fire skinner rundt seksjonen med underkant i
  CC-høyden, 93 på utvendige kanter og 94 mot en naboseksjon, og MDF 6 mm i falsen med overkant 36 over skinnens
  underkant, like stor som toppen. To naboseksjoner med hylle i samme høyde deler 94-skinnen. Skinnen står også der
  delen er åpen eller har skyvedør. Mot en lavere nabo står skinnen over den lave toppen som 93 vendt mot den, og
  trinnplaten deles ved den; i høyde med den lave toppen er 94-en under toppen nok. Hyllene slås av og på i skuffen (for
  seksjonen bak delen, eller alle langs siden) og dras opp og ned i risset med grepet «Hylle 50 cm»: draget snapper til
  CC-høydene og stopper mot en nabohylle og mot toppen. Et grep som legger på seksjoner gir dem hyllene til seksjonen det
  strekker. Tid, plassholder: 1,5 min opp og 1 ned per hylle (som H7, Bjørn 13.11.2026), unntatt hyllen i CC 750 i en
  seksjon som er 500 dyp: den er med i tiden per seksjon (K9), som i 6560. Tilbudet sier «3 hyller». Det lysåpningen
  er (K16) og fargen dens (K6) følger den: en ny hylle deler den i to, og begge halvdelene beholder valget og fargen; tas
  hyllen ut, blir de to til den nederste, som beholder sitt.
  *Bjørn 13.11.2026 og 18.11.2026 · kode `src/foga/counter.ts` (`shelfRails`), `src/domain/podiumShelves.ts` · test `src/domain/podiumShelves.test.ts`, `src/calc/podium.test.ts`*
- **K20 Print og dekal på disk.** På plate og skyvedør, aldri på åpen lysåpning eller trinnplate. Print er heldekkende
  dekal, ikke trykk på platen, og ligger per plate (lysåpning) mellom stolpene og skinnene etter plateregelen (V15):
  kosten hele motivet på én plate, spannet ett bilde over platene på siden som vises, fra første dels venstre stolpe til
  siste dels høyre og fra bunnskinnen til den høyeste toppen. En del valgt i skuffen får ett bilde over platene sine, en
  lysåpning valgt hele motivet. En printet plate har ingen egen farge, og er alle platene printet, får disken
  lagerfargen. En dekal har mål og plass på delen (fra midten av seksjonens side, sett utenfra) og flyttes og skaleres i
  risset som på vegg, holdt innenfor delen. Print med spannet tar bort dekalene på siden, print med kosten dekalene på
  platen, og en dekal tar bort printen. Vist i risset, i planen (en tynn stripe av motivet innenfor ytterkanten) og i 3D. Print prises
  på eget artikkelnummer 8023 «Foliedekor, diskfelt» per m², med målene som kuttes på linjen («2 × 960 × 960 mm»), dekal
  som m² dekal (8020) og en oppstart per print strukket over flere deler (8022).
  *Bjørn 13.11.2026, 18.11.2026 · kode `src/domain/podiumDecor.ts`, `src/calc/lines/decor.ts`, `src/ui/plan/podiumDrawer/paint.ts` · test `src/domain/podiumDecor.test.ts`, `src/ui/plan/podiumDrawer/paint.test.ts`*
- **K22 Standardvarer i Disker og podier.** Det som er tegnet og bygget nøyaktig som en standardvare, *er* den varen:
  katalogpris, kostet som én leid vare (`ITEM.counter` per utvendig mål og høyde), plukket hel som 1 stk, og navnet fra
  katalogen med varianten, uten varenummer: «Bardisk», «Podie 50 × 50, 75 cm». Farge (K6), print og dekal (K20), snudd
  og flyttet endrer ikke varen; alt annet gjør den til spesialbygg (K13).
  **Bardisk 6560:** én seksjon 1000 × 500 c/c, CC 1000, hylle i CC 750 og baksiden åpen i begge lysåpningene, bygget
  som disken på lager (K1–K5), 1320 kr. **Podie 50 × 50 (5450)** (Bjørn 14.11.2026): én tett seksjon 500 × 500 uten
  hylle, hver høyde sin variant med egen pris: 25 cm (CC 250) 5450-4, 50 cm 5450-1, 75 cm 5450-2 og 100 cm 5450-3. Et
  varenummer skifter aldri betydning, så 25 cm, som kom sist, fikk det siste nummeret; katalogen viser dem etter høyde.
  **Pennen** velger etter funksjon (Bjørn 14.11.2026): «Fri» (en seksjon 500 × 500 per klikk, i pennens høyde, så et
  klikk gir et Podie 50 × 50), så én knapp per undergruppe i katalogen som har en standardvare, «Disk» og «Podie», med
  omrisset av varen bak. Bak hver funksjon står varen som sist ble hentet fra katalogen for den, i starten den første
  (for Podie den i høyden Fri har). Et klikk med «Disk» setter disken med fronten mot den åpne siden av standen på tvers
  av den (den nærmeste når begge er åpne, ellers bort fra nærmeste kant); med «Podie» setter det podiet rett, i høyden
  valgt i pillen, som velger varen. Høydene varen ikke finnes i, og «Fin», er grå mens en funksjon er i hånden. Å dra med
  «Podie» tegner fritt i podiets høyde. Å dra med «Disk» tegner en disk bygget som disken i hånden (Bjørn 16.11.2026):
  samme dybde, høyde og hylle og åpen bak i hver seksjon, og den vokser bare i lengden, i steg på 0,5 m (Shift og «Fin»
  endrer ikke steget); blir den 1 m, er den 6560. «Roter» i pillen (tast R på desktop) dreier varen i hånden 90° per
  trykk; knappen er grå for «Fri» og Podie 50 × 50, som er kvadratiske. I Utstyr setter + en vare fra Disker og podier,
  og penselen der legger varen bak sin funksjon og i hånden.
  *Bjørn 13.11.2026 · kode `src/domain/podiumStock.ts`, `src/domain/podiums.ts`, `src/calc/lines/objects.ts`, `src/ui/panel/sections/EquipSection.tsx`, `src/ui/podiumPen.ts`, `src/ui/plan/pointer/podium.ts`, `src/ui/plan/quick/podium.tsx`, `src/ui/useShortcuts.ts` · test `src/domain/podiumStock.test.ts`, `src/domain/podiums.test.ts`, `src/ui/podiumPen.test.ts`*
- **K23 Disk over fotplate.** En disk som står over en fotplate (750 under vegg og takdragerstolpe, S2 og T12, eller
  740/730 under frittstående tekstilvegg, X8), også en standardvare (K22), får en innsats 700 uten settskrue i midtrøret
  på hver stolpe (alle profilene i 90-serien har midtrør). Innsatsen bygger om lag 7 mm, så bunnskinnene går fri av
  platen på 5 mm. En stolpe som står på selve platen får ingen; den står da om lag 2 mm lavere, og det er greit.
  Fotplaten blokkerer ikke disken. Prisen er den samme, også for 6560; innsatsene er i kostnaden og plukkes under Disker
  på arbeidsordren. En disk som ikke står over en plate kan settes på innsats i skuffen (bryteren Innsats 700 ved
  høyden), så den blir like høy som diskene over en plate (Bjørn 16.11.2026). I 3D står disken 7 mm opp på en svart
  kloss 20 × 20 × 7 mm under hver stolpe med innsats.
  *Bjørn 16.11.2026 · `RECIPES.counter.insert` · kode `src/domain/counters.ts`, `src/calc/context.ts`, `src/calc/textile/free.ts`, `src/calc/lines/objects.ts`, `src/foga/engine.ts`, `src/ui/scene3d/build/counter.ts`, `src/ui/plan/podiumDrawer/PodiumDrawer.tsx` · test `src/calc/counterInserts.test.ts`*

## P · Plukkliste og arbeidsordre

- **P1 Ferdige enheter.** Det som lagres ferdig montert, plukkes som stk: stolpe 94 med fot eller uten fot, fotplate 750
  med 795, topp- og bunnskinne med 600, takdrager per lengde med 600, støttestag 90 med 600, dørblad og skjøt 94 × 80
  med 609 eller 600, og krok 01 enveis eller toveis med M5 og 503.
  *Bjørn 31.10.2026 · kode `src/foga/engine.ts` · test `src/foga/engine.test.ts`*
- **P2 Løse deler.** Uten ferdig enhet plukkes delene: 43TX per kappelengde, 92LTX, 617, 609, 604, 520, 740 og 730.
  *Bjørn 31.10.2026 · kode `src/foga/engine.ts` · test `src/calc/freeFrames.test.ts`*
- **P3 Faktisk antall.** Plukklisten teller artiklene i tegningen (moduler som møtes deler stolpe), ikke det salgsproduktet
  regner med per meter.
  *Bjørn 31.10.2026 · kode `src/foga/fromVariant.ts` · test `src/calc/calc.test.ts`*
- **P4 Arbeidsordre.** Arbeidsordren er plukklisten montøren får: uten art.nr. for Foga-deler og uten bestanddelene i
  ferdige enheter. Den egne siden Plukkliste er fjernet (Bjørn 8.11.2026); en samlet plukkliste for et helt
  arrangement hører til OMS senere.
  *Bjørn 2.11.2026 · kode `src/ui/workorder/WorkOrderPage.tsx` · test `src/foga/engine.test.ts`*

## B · Hvem bygger

- **B1 Arrangørens standvegger.** Betaler arrangøren standveggene, bygger arrangøren dem og standard takdragerne (med
  stolpene bare de trenger, og støttedragerne). De er da ute av utstillerens tilbud, plukkliste og arbeidsordre. En
  stolpe i arrangørens standvegg er arrangørens, også når en innervegg står inntil. Detaljer i [vegger.md](vegger.md).
  *Bjørn 31.10.2026 · kode `src/calc/context.ts` · test `src/calc/beams/supportBeams.test.ts`*
- **B2 Alltid utstillerens.** Innvendige takdragere, fotplater (også under arrangørens vegger), skjøt over tekstilvegg og
  platebytte i en standvegg bygges og betales av utstilleren. En øy uten standvegger: utstilleren betaler takdragerne.
  *Bjørn 31.10.2026, 1.11.2026 og 6.11.2026 · kode `src/calc/context.ts`, `src/calc/lines/beams.ts` · test `src/calc/beams/innerBeams.test.ts`*

## Ikke bygget ennå

Bestemt eller nevnt, men ikke i koden: velge type hjørne der en frittstående tekstilvegg møter en ramme på vegg (Bjørn 20.11.2026: 92LTX er bedre enn å stoppe mot rammen etter X11, fordi alle profilkanalene for tekstil er tilgjengelige, mens en utenpåliggende ramme sperrer kanalene og må monteres etter tekstilen), flere høyder på frittstående tekstilvegg (over 2540 tas i egen utredning om høye vegger), støttevaier fra hallens tak i stedet for fotplater (samme regel som S3), tekstildør
med overstykke, høye tekstilvegger, heng (H6), og endring av standvegg med nabogodkjenning. Samba-duk foran LED (appen tegner ikke LED ennå).
