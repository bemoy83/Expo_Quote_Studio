# Byggeregler

Alle byggetekniske regler appen følger, med nummer, én gang. Hver regel sier hva som gjelder, hvem som bestemte den og
når, hvor verdiene står, hvilken kode som gjør det og hvilken test som passer på det. Bakgrunn, mål og tverrsnitt står
i [foga-system.md](foga-system.md), veggbegrepene i [vegger.md](vegger.md), pris og tid i [prismodell.md](prismodell.md).

## Slik brukes registeret

- **Nummeret er regelens navn.** Bokstaven er området (V vegg, S støtte, T takdrager, D dør, R rom, X tekstil, G gulv,
  P plukk, B hvem bygger, H hylle, K disk). Et nummer brukes aldri om igjen: en regel som faller bort, blir stående som «utgått».
- **Én kilde per regel.** Regelen står her. Koden viser til nummeret («Byggeregel T7») i stedet for å gjenta teksten,
  og foga-system.md forklarer bakgrunnen.
- **Verdier er data.** Mål, avstander og antall står i `src/rules/rules.ts` (mål i meter) og `src/foga/recipes.ts`
  (deler og mm), aldri i regelkoden. Art.nr. står i `src/foga/parts.ts`.
- **Ny eller endret regel:** skriv den her først, legg verdiene i rules.ts eller recipes.ts, la koden vise til
  nummeret, og skriv en test. `src/test/byggeregler.test.ts` sjekker at hver regel har kode som viser til den, at
  filene finnes, og at koden ikke viser til et nummer som ikke står her.

Formen er: **Nummer Navn.** Regelen. *Kilde · verdier · kode · test.*
Er en del av regelen bestemt, men ikke i koden ennå, står det «ikke bygget» etter kilden, med hva som mangler.

## V · Systemvegg

- **V1 Modul.** En systemvegg (standvegg, innervegg, romvegg) bygges i moduler på cc 1000 mellom stolpesentrene.
  Fysisk lengde er cc pluss én stolpe: 4000 c/c er 4040. Veggpenselen tegner hele moduler fra metergitteret, og med
  Shift eller «Fin» fra en 250-node i 250-steg, på metergitterets linjer; Shift trykket eller sluppet midt i streken
  låser det som er tegnet og går videre derfra. En strek over vegger som står legger bare til resten. Tøm tar en hel
  modul, også en kort. Kortere moduler finnes i samme steg som diskene (K10): 250, 500 og 750 c/c. En vegg legges i hele meter fra der den starter, og er lengden ikke
  hel, er den siste modulen kortere (1750 = 1000 + 750). Delene er de samme, kappet: skinnene c/c − 40 (210, 460, 710),
  platen c/c − 24 (226, 476, 726) og lysåpningen c/c − 40. Dør, forheng og hyller står bare i hele moduler. Tilbudet
  selger metrene til veggens meterpris (1,75 m). Kostnaden er de kappede skinnene og platen som sin andel av de hele
  (profilen per meter, platen etter bredde) og kappingen, plassholder 2 min per skinne og 3 per plate. Plukklisten
  viser de kappede lengdene.
  *Bjørn 31.10.2026, 6.11.2026 og 14.11.2026 · `rules.wall.cc`, `rules.wall.post`, `ITEM.rail`, `ITEM.cutPlate`, `ITEM.railCut`, `ITEM.plateCut` · kode `src/domain/walls.ts`, `src/domain/grid.ts`, `src/domain/faces.ts`, `src/calc/lines/walls.ts`, `src/calc/context.ts`, `src/cost/itemDefs.ts`, `src/foga/engine.ts`, `src/domain/snapGrid.ts`, `src/ui/plan/pointer/stroke.ts` · test `src/foga/engine.test.ts`, `src/domain/shortModules.test.ts`, `src/calc/shortModules.test.ts`, `src/domain/snapGrid.test.ts`*
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
  meter, ikke inn på en standvegg. Frittstående flyttes i begge retninger, inntil en annen innervegg bare til siden.
  *Bjørn 31.10.2026 og 1.11.2026 · kode `src/domain/edit.ts` · test `src/domain/standWalls.test.ts`*

## S · Støtte for systemvegg

- **S1 Rammen holder.** Med takdrager på står standveggene i takdragerrammen og får ingen fotplater.
  *Bjørn 1.11.2026 · kode `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S2 Fotplate.** En systemvegg som står fritt (takdragerne valgt bort, eller en inner- eller romvegg rammen ikke
  holder) får fotplate 750 (500 × 80 × 5) med stolpefeste 795 under stolper, midt under veggen og på tvers av den.
  Platen stikker inn til naboen og ut i gangen; det er godtatt.
  *Bjørn 1.11.2026 · `RECIPES.wall.support` · kode `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S3 Avstand.** Per rett strekning: en plate i hver fri ende, maks 3 m mellom to støtter, og en endeplate trekkes inn
  hele stolper (maks 1 m) bare så langt avstanden krever. Minst 2 gjelder bare en rett vegg fri i begge ender, fra 1 m.
  3 m: endene. 4 m: den ene 1 m inn. 5 m: begge 1 m inn. 6 m: tre.
  *Bjørn 1.11.2026 · `RECIPES.wall.support.rule` · kode `src/calc/supports.ts`, `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S4 Ut fra hjørne.** Ut fra et hjørne eller en T står veggen av seg selv opptil 1 m (1 × 1 trenger ingen plate). Over
  1 m får den én plate, deretter gjelder S3.
  *Bjørn 3.11.2026 · kode `src/calc/supports.ts` · test `src/calc/wallSupports.test.ts`*
- **S5 Hva som holder.** Et hjørne, en T eller et kryss med en annen systemvegg (et rom holder veggene det står
  inntil), og en stolpe under en takdrager.
  *Bjørn 1.11.2026 · kode `src/calc/wallSupports.ts` · test `src/calc/wallSupports.test.ts`*
- **S6 Fire låste sider.** Med takdrager på får en strekning som er holdt i begge ender, og der endene henger sammen
  rundt en annen vei med vegger og takdragere (en lukket firkant), ingen plater.
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
  7 → 4 + 3, 13 → 5 + 4 + 4. Det er stolpe i hver skjøt.
  *Bjørn 31.10.2026 · `rules.beam.max` · kode `src/calc/beams/beamSegments.ts`, `src/calc/beams/beams.ts` · test `src/calc/calc.test.ts`*
- **T3 Standard takdrager.** Legges langs de åpne sidene av standen. En ende mot en vegg deler veggens stolpe.
  *Bjørn 31.10.2026 · kode `src/calc/beams/beams.ts` · test `src/calc/calc.test.ts`*
- **T4 Vegg deler drageren.** Der en vegg møter eller krysser en takdrager, også enden av en inner- eller romvegg, deles
  drageren og deler veggens stolpe. Hver side er egen lengde etter T2.
  *Bjørn 1.11.2026 · kode `src/calc/beams/beams.ts` · test `src/calc/calc.test.ts`*
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
- **T8 Innvendig takdrager.** Tegnes av kunden, rett og i hele meter innenfor standen, aldri langs en vegg eller oppå en
  annen takdrager. Samme profil, høyde og deling (T1, T2) som standard.
  *Bjørn 1.11.2026 · kode `src/domain/innerBeams.ts`, `src/calc/beams/innerBeams.ts` · test `src/domain/innerBeams.test.ts`*
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
- **T12 Egne stolper.** En tegnet takdrager har stolper bare i frie ender og 6 m-skjøter, og ingen tverrdrager. Under
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

## R · Rom

- **R1 Bare det som mangler.** Et rom bygger bare veggene som ikke finnes. Står det inntil en standvegg, gjenbrukes den;
  to rom side om side deler veggen.
  *Bjørn 31.10.2026 · kode `src/domain/rooms.ts` · test `src/domain/rooms.test.ts`*
- **R2 Form.** Et rom har ikke tak. Omrisset er rettvinklet (rektangel, L, U, T, Z) uten hull, og ingen side er under
  1 m. En L kan dras til et rektangel; et rektangel blir L bare ved å tegne vegger.
  *Bjørn 31.10.2026 · kode `src/domain/outline.ts`, `src/domain/rooms.ts` · test `src/domain/rooms.test.ts`*
- **R3 Frihåndsrom.** Vegger som lukker et område med en dør, blir et rom. Siden en dør ikke kan stå i en standvegg, kan
  ikke en standvegg alene lukke et rom.
  *Bjørn 31.10.2026 · kode `src/domain/enclosures.ts` · test `src/domain/enclosures.test.ts`*
- **R4 Det som står i rommet.** Møbler i rommet følger rommet, og en tekstilvegg som fyller en romside vokser og krymper
  med den.
  *Bjørn 31.10.2026 · kode `src/domain/rooms.ts` · test `src/domain/rooms.test.ts`*

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
  0,25 m. Tegnes som veggen: 1 m-steg fra metergitteret, med Shift eller «Fin» 250-steg fra en 250-node (Bjørn
  14.11.2026: Shift erstatter rutenettvelgeren, ett tegnespråk for vegg, tekstil og disk). Ikke langs eller gjennom en systemvegg (helt inntil er lov). Den
  lager ikke rom og kan ikke ha dør.
  *Bjørn 31.10.2026 · `rules.textile` · kode `src/domain/textile/free.ts` · test `src/domain/textile/free.test.ts`*
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
  kortere.
  *Bjørn 6.11.2026 · kode `src/calc/textile/placement.ts`, `src/calc/textile/free.ts` · test `src/calc/textile/placement.test.ts`*

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
  og dekal er lov. Heng står bare mellom stolper med ledig kanal.
  *Bjørn 8.11.2026, endret 10.11.2026 · kode `src/domain/fittings.ts`, `src/domain/shelves/corners.ts` · test `src/domain/shelves/shelves.test.ts`, `src/domain/shelves/corners.test.ts`*
- **H7 Pris per hylle.** Samme pris per hylle alene og i rad, som systemvegg (fast katalogpris; kostmotoren gir kost og
  tid). Direkte tid 1,5 min opp og 1 min ned per hylle, også i hjørner. Indirekte tid per ordre kommer i tillegg:
  vareplukk 10 min én gang per ordre med hyller, og gange per arbeidsordre (ikke bygget ennå). Stolpene er en del av
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

- **K1 Bardisk 6560.** Disken på lager er 1020 × 520 × 1040 mm utvendig: én kasse av Foga-profiler, lukket foran og i
  begge ender, åpen bak der standpersonalet står. Den kommer ferdig montert og plukkes som 1 stk så lenge lageret rekker.
  I tilbudet er den én linje per stk til fast pris (1320 kr); kalkylen regner kost og tid fra det den er bygget av
  (K2–K5). Den plasseres og kolliderer som et møbel, og fronten er den lukkede langsiden. Den erstatter de oppdiktede
  diskene 5410, 5415 og 5420 (en gammel skisse beholder dem som løse linjer). Den settes ut som et ferdig oppsett i
  Disker og podier (K22). Kunder bestiller også andre lengder og hjørner, som bygges på stedet (K10–K13).
  *Bjørn 11.11.2026 · `RECIPES.counter.stock` · kode `src/foga/recipes.ts`, `src/catalog/defaultCatalog.ts`, `src/calc/lines/objects.ts`, `src/cost/itemDefs.ts` · test `src/foga/counter.test.ts`, `src/calc/counter.test.ts`*
- **K2 Hjørnestolpe.** 92L (873 050 22, 30 × 30, kanal på de to innersidene) i hvert hjørne, hele høyden 1040 mm, med de
  lukkede sidene ut. Disken står rett på gulvet uten justeringsfot, så disker kan settes helt inntil hverandre. Trengs
  justeringsfot, bygges den utenfor 92L (ikke bygget).
  *Bjørn 11.11.2026 · `RECIPES.counter.post`, `height`, `postSize` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K3 Skinner.** 93 (873 060 22, 30 × 40, kanal i begge ender og på innsiden) rundt alle fire sidene i midten (750–790)
  og øverst (1000–1040), og 92 på gulvet foran og i begge ender; bak er det ingen bunnskinne. Skinnene står mellom
  stolpene: sidens lengde − 2 × 30, altså 960 og 460. Én 600 i hver skinneende, 22 per disk.
  *Bjørn 11.11.2026 · `RECIPES.counter.rail`, `bottomRail`, `middle`, `top`, `coupling` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K4 Plater.** Samme veggplate som systemveggen (V5, 3 mm) i kanalene foran og i begge ender, delt ved midtskinnen:
  976 × 726 og 976 × 226 foran, 476 × 726 og 476 × 226 i hver ende. Platen går ned i kanalen og står 2 mm kort i hver
  ende og 4 mm kort i toppen. RAL, print eller dekal på lysmålet i disken er bestemt, men ikke bygget (egen PR).
  *Bjørn 11.11.2026 · `RECIPES.counter.plate`, `channel`, `platePlay` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K5 Topp og hylle.** MDF malingsmelamin Fibraplast H Barnizable hvit/hvit 6 mm, 976 × 476, ikke Foga. Toppen ligger i
  falsen på den øverste 93 (1030–1036, 4 mm under skinnens overkant), hyllen i falsen på den midterste (780–786). Platen
  står 2 mm fra skinnens kropp på alle sider.
  *Bjørn 11.11.2026 · `RECIPES.counter.board`, `boardPlay` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K6 Farge på disken.** Alle platene på en disk har samme farge, en av veggfargene (RAL som systemveggen). Disken på
  lager er hvit 9010; en annen farge betyr at platene byttes på lageret før messen og tilbake etter. Prisen er den samme
  i alle farger (1320 kr), kalkylen tar med kostnaden for platebyttet (prisartikkelen platebytte bardisk), og linjen sier
  hvilke farger montøren skal ha med. Fargen følger ikke veggenes standardfarge, og spannet på veggene farger ikke
  diskene: Disker og podier har sitt eget spann.
  *Bjørn 11.11.2026 · `RECIPES.counter.stock.ral` · kode `src/domain/objects.ts`, `src/calc/lines/objects.ts`, `src/cost/itemDefs.ts` · test `src/calc/counter.test.ts`, `src/domain/objects.test.ts`*
- **K7 Lengder.** En disk er 520 dyp og går i lengder på 0,5 m: knutepunktene står 1000 c/c, og en halv modul på
  500 c/c tar resten (1520 = 1000 + 500). Utvendig er disken c/c + 20, fordi knutepunktet står 10 mm inn fra
  ytterflaten: 520, 1020, 1520, 2020. Skinnene er c/c − 40, altså 960 og 460, og platene og toppene 976 og 476. Disker og
  podier (K10) bruker de samme målene på et raster på 250. Verktøyet Disker, som tegnet disker i halve meter med
  endegrep, L bakover mot personalet og kortere fra en fri ende, er tatt bort (Bjørn 13.11.2026): alle disker tegnes i
  Disker og podier, og en skisse med disker fra Disker gjøres om når den åpnes (K22).
  *Bjørn 12.11.2026, 13.11.2026 · `RECIPES.counter.module`, `face`, `joint` · kode `src/foga/counter.ts`, `src/domain/counterShape.ts` · test `src/foga/counter.test.ts`, `src/domain/podiumStock.test.ts`*
- **K8 Knutepunkt.** Profilen som står i et knutepunkt, velges etter retningene den kobler: to i L gir 92L, tre i T gir
  93, fire i kors gir 94. Skinnene blir like lange uansett profil; bare antall retninger profilen kan kobles i er
  forskjellig. En skjøt i en rett disk er derfor en 93 foran og en bak. Hver del mellom fire knutepunkter har sin topp;
  skinnen mellom to deler er 94 og bærer toppen fra begge sider.
  Disken tettes bare utvendig: ingen plater og ingen bunnskinne inne i disken. I planen har disken ett omriss rundt hele seg, hel strek der den er lukket og en tynn, lys hårstrek
  der den er åpen (Bjørn 13.11.2026: stiplet i planen hører til gangside og takdrager, og uten strek forsvinner en hvit disk
  på hvitt gulv). Begge strekene ligger innenfor ytterkanten. En tynn delelinje
  går på tvers av disken der to deler møtes, over 94-skinnen mellom dem. Valgt disk viser utvendig helmål i planen:
  bredde og dybde på siden mot midten av standen, en L sine to ytre lengder. Arbeidsordren viser helmålene på alle
  disker som bygges på stedet; en standarddisk (K22) får ingen.
  *Bjørn 12.11.2026 · `RECIPES.counter.nodes`, `innerRail` · kode `src/foga/counter.ts` · test `src/foga/counter.test.ts`*
- **K9 Tid for disk bygget på stedet.** En disk som bygges på stedet, prises av kostmotoren fra det den er bygget av
  (profiler per meter, 600, plater per m², topper og hyller) og arbeidet, likt i alle farger; 6560 beholder fast pris
  (K1, K22). Tiden er plassholder til Bjørn har målt: 26 min i alt per hel meter (plukk, vask og transport 2 + 2 + 2,
  montering 13, demontering 7), halvparten per halv meter (1 + 1 + 1, 6, 4) og 6 til per hjørne (4, 2), så en disk på
  1,0 m bygget på stedet koster omtrent 1320 som 6560 (20–30 min på 1 m, Bjørn). Hvordan tiden telles per seksjon og
  linjen og plukket, står i K13.
  *Bjørn 12.11.2026 (tid forslag) · `ITEM.counterProfile`, `counterWhole`, `counterHalf`, `counterCorner` · kode `src/calc/lines/objects.ts`, `src/cost/itemDefs.ts`, `src/foga/counter.ts`, `src/foga/engine.ts`, `src/domain/counters.ts` · test `src/calc/podium.test.ts`*
- **K10 Seksjoner.** En disk eller et podie fra Disker og podier er satt sammen av seksjoner på et raster på 250 mm:
  250, 500, 750 eller 1000 c/c i hver retning. Et knutepunkt står i hvert hjørne av hver seksjon. Utvendig mål er
  c/c + 20 (270, 520, 770, 1020 …), skinnene c/c − 40 (210, 460, 710, 960), platene og toppene c/c − 24 (226, 476, 726,
  976). En lengde deles i hele meter først og resten sist, regnet fra seksjonen man startet i (1750 = 1000 + 750).
  Fasongen er fri så lenge seksjonene henger sammen langs en kant på minst 250; alle fasonger går, også T og kors (K7s
  «hjørne bare bakover» gjaldt bare Disker). Disker og podier er verktøyet for alle disker (tast D). Med «Fri» i
  hurtigvalget (K22) viser pennen én seksjon 500 × 500 dempet midt under pekeren, inntil vegg, disk eller standkant innen
  10 cm, og ingenting over en disk; et klikk lagrer den, et klikk på en disk velger den. Trykk og dra tegner videre fra
  seksjonen, som står fast fra trykket: i hver retning for seg vokser disken `round(d / 500) × 500` på den siden når
  pekeren går `d` forbi kanten, inne i seksjonen skjer ingenting, og begge retninger gir et rektangel. Der den ikke får
  plass, nektes den med «Ikke plass til disken her». En disk kan stå helt inntil en vegg. Med Shift (som i CAD: det man
  har tak i, avgjøres av hvor man trykker, aldri av hvilken vei man drar) står forhåndsvisningen stille, og pekeren kan
  flyttes over den. Et trykk ved en kant eller et hjørne (utenfor den midterste tredjedelen) tar tak i den kanten, som
  vises tykk mens man peker, og flytter den `round(Δ / 250) × 250` ut eller inn til 250; motsatt kant står stille. Et
  trykk midt i tegner fra rasterlinjen gjennom trykket til den nærmest pekeren, minst 250, og de første 75 mm endrer
  ingenting. Shift trykket eller sluppet midt i et drag låser det som er tegnet og går videre derfra; tastetrykket alene
  endrer aldri størrelsen. «Fin» i hurtigvalget gjør det samme som Shift for berøring, uten å fryse forhåndsvisningen.
  Påbygg: er pekeren utenfor en disk fra Disker og podier og innen 300 mm fra yttersiden av en av sidene, legger
  seksjonen seg inntil siden i diskens raster. Den glir langs siden i 500-steg regnet fra sidens ende (250 med Shift
  eller Fin) og stikker høyst 250 utenfor enden. Et klikk eller drag derfra tegner som over, men kanten mot disken står
  alltid fast, uansett hvor man trykker. Påbygget blir en del av disken: én disk, én linje, diskens farge, og høyden til
  seksjonen det ligger mot. Nektes med «Disken kan ikke gå over seg selv», «En del ville stått løst» (deler mindre enn
  250 med siden) eller «Ikke plass til disken her». Pillen viser påbygget c/c og disken utvendig etterpå:
  «+ 500 × 500 · 2 020 × 1 020».
  *Bjørn 13.11.2026 · kode `src/domain/podiums.ts`, `src/domain/counterShape.ts`, `src/domain/types.ts` · test `src/domain/podiums.test.ts`*
- **K11 Tett bygg.** Alle utvendige sider er tette: bunnskinne 92 og toppskinne 93 på hver utvendig kant, og én
  veggplate i hele høyden i kanalene, mellom bunnskinne og toppskinne. Det er ingen midtskinne og ingen hylle i
  grunnbygget; hyller kommer senere på egne skinner. Inne i disken står ingen plater og ingen bunnskinne; mellom to
  seksjoner går en 94 øverst som bærer toppen fra begge sider. Hver seksjon har sin topp, MDF 6 mm som K5, også på
  podier. Profilen i knutepunktet følger K8: to retninger 92L, tre 93, fire 94 (en L av 500 × 500 med to ben på 1000 har
  94 i innerhjørnet).
  *Bjørn 13.11.2026 · kode `src/foga/counter.ts`, `src/domain/counterShape.ts` · test `src/domain/podiums.test.ts`*
- **K12 Høyde.** CC 250, 500, 750 eller 1000: toppskinnen står med underkant i den høyden, stolpen er CC + 40 (290,
  540, 790, 1040), og platen CC − 24 høy. Høyden lagres per seksjon. Høyde i hurtigvalget (250, 500, 750, 1000, ved
  siden av fargen, 1000 til noe er valgt) gir høyden alt i ett drag tegnes med; et påbygg arver høyden til seksjonen det
  ligger mot. Der to seksjoner med ulik høyde møtes (etter en fusjon), står en 94 under den lave toppen og en 93 i den
  høyes høyde mot den lave siden, og trinnet lukkes med en plate mellom dem, høydeforskjellen − 24 høy; stolpene der
  går til den høye. Høyden står i pillen («H 540») og i linjen i tilbudet, med alle høydene når disken har flere
  («540/1040»). Å endre høyden på en seksjon som står, kommer med skuffen i trinn 2.
  *Bjørn 13.11.2026 · kode `src/foga/counter.ts`, `src/domain/podiums.ts`, `src/ui/plan/quick/podium.tsx` · test `src/domain/podiums.test.ts`*
- **K13 Pris og plukk for Disker og podier.** Ett katalogprodukt per funksjon for det som bygges på stedet: «Disk»
  (6571) under Disker og «Podie» (6572) under Podier (varenumrene er midlertidige). Hver er priset av kostmotoren fra
  delene og arbeidet, én linje per disk eller podie, «bygget på stedet L × D × H mm», og delene plukkes løse under
  Disker. Alle navn hentes fra produktlisten (Bjørn 14.11.2026): linjen, pillen, skuffen, arbeidsordren og
  hurtigvalget heter det produktet heter. Det som tegnes med «Disk» i hånden, er en disk, og med «Podie» et podie. Det
  «Fri» tegner, er standardvaren det er (K22) sin funksjon, ellers en disk når fasongen ikke er dypere enn 500 noe sted
  (ingen 750 × 750 får plass i den), ellers et podie; det bestemmes når det tegnes, og et påbygg beholder sitt. En
  skisse lagret med det gamle 6570 gjøres om etter fasongen når den åpnes. Toppene har prisartikler for alle målene i K10. Tid, plassholder:
  `counterWhole` per seksjon med lengste side over 500, `counterHalf` per seksjon ellers, `counterCorner` per innvendig
  hjørne i omrisset, med tidene i K9.
  *Bjørn 13.11.2026 · `ITEM.counterBoard`, `counterWhole`, `counterHalf`, `counterCorner` · kode `src/calc/lines/objects.ts`, `src/cost/itemDefs.ts`, `src/catalog/defaultCatalog.ts`, `src/catalog/podium.ts`, `src/domain/podiums.ts`, `src/ui/podiumPen.ts`, `src/persistence/file.ts` · test `src/calc/podium.test.ts`, `src/domain/podiums.test.ts`, `src/ui/podiumPen.test.ts`, `src/persistence/file.test.ts`*
- **K14 Grep på valgt disk.** En valgt disk fra Disker og podier viser grep som i et CAD-verktøy, i Velg og med
  pennen: ett midt på hver rette side av omrisset (hele siden, også over flere seksjoner) og ett i hvert hjørne av
  boksen rundt (flytter de to sidene av boksen som møtes der). Et grep flytter kanten i 500-steg, 250 med Shift eller
  Fin. Ut: seksjonen ved siden strekkes til 1000 før en ny legges til, hele meter først og resten sist; en seksjon som
  bare delvis ligger langs siden, strekkes ikke, det legges en ny ved siden av. Inn: seksjoner krympes og fjernes, vist
  med skravur før slipp; to seksjoner som da får plass i én (samme spenn, samme høyde, til sammen høyst 1000), blir én.
  Minste disk er 250 × 250: lenger inn stopper grepet. Nektes med «En del ville stått løst», «Disken kan ikke gå over
  seg selv» eller «Ikke plass til disken her».
  *Bjørn 13.11.2026 · kode `src/domain/podiumGrips.ts` · test `src/domain/podiumGrips.test.ts`*
- **K15 Fusjon og lenker.** En disk fra Disker og podier som dras med Velg innen 300 mm fra en annen, legger seg inntil
  den, flate mot flate, med knutepunktene i dens raster og minst 250 felles langs siden. Ved slipp blir de én disk: den
  som sto stille, beholder fargen og plassen, og den som ble dratt, legges på dens knutepunktlinje (20 mm inn, de to
  flatene blir én skjøt). En skjøt er en rett linje inne i disken der seksjoner møtes; valgt disk viser et lenkeikon
  midt på hver skjøt. Et klikk bryter lenken: den største delen blir stående, de andre blir egne disker med samme farge,
  flyttet 20 mm ut slik at de står flate mot flate. Deler ikke skjøten disken alene: «Skjøten deler ikke disken alene:
  bryt også skjøten ved siden av». Mot en disk som står inntil, vises en brutt lenke, og et klikk lenker dem. Disker med
  ulik høyde slås sammen også; hver seksjon beholder sin høyde, og trinnet bygges etter K12. To disker som står inntil hverandre uten lenke, er
  to linjer i tilbudet og har plater mot hverandre.
  *Bjørn 13.11.2026 · kode `src/domain/podiumLinks.ts` · test `src/domain/podiumLinks.test.ts`*
- **K16 Sider og lysåpninger.** Hver del av omrisset, mellom to knutepunkter, hører til seksjonen bak og er delt i
  lysåpninger av hylleskinnene i seksjonen (K19): en under den nederste skinnen og en over hver; uten hyller er delen én
  lysåpning. Hver lysåpning er plate, åpen eller (K17) skyvedør. Plate er standard (K11) og lagres ikke; platen går fra
  skinnen under til skinnen over, i høydene 226, 476, 726 og 976. Åpen: ingen plate, og ingen bunnskinne når det er
  den nederste lysåpningen (som baksiden på 6560, K3 og K4); de andre skinnene og stolpene står. Med hele siden eller en
  del valgt gjelder valget alle lysåpningene i den; et klikk på én lysåpning i risset velger bare den. En ny hylle deler
  en lysåpning i to som begge beholder valget, og en hylle som tas bort slår de to sammen til den nederste, som beholder
  sitt. Valget lagres på seksjonens side, så det følger delen: flytt og roter
  endrer ingenting, et grep som strekker en seksjon strekker valget med, en ny del er plate, og en side som blir
  innvendig (påbygg, fusjon) mister valget. To seksjoner slås bare sammen (K14) når sidene langs dem har samme valg. En
  del med en vegg eller en annen disk nærmere enn 60 mm utenfor seg er alltid plate; valget beholdes og kommer tilbake
  når disken flyttes ut. Trinnplaten (K12) er alltid plate. I planen er en del som er åpen i hele høyden en tynn, lys
  hårstrek (som 6560), og en del med skyvedør i en lysåpning hel strek med dørstreker. Valget gjøres i skuffen for
  disken. Tilbudet sier hvor mange sider som har en åpen lysåpning: «1 åpen side». Arbeidsordren tegner hver side som
  har annet enn plate, hyller bak seg, eller print eller dekal, sett utenfra og målsatt som i skuffen («Disker sett
  utenfra»).
  *Bjørn 13.11.2026 · kode `src/domain/podiumFaces.ts`, `src/domain/podiumLocks.ts` · test `src/domain/podiumFaces.test.ts`*
- **K17 Skyvedør.** To plater i sporet i skinnen under og skinnen over lysåpningen, i stedet for én plate. Hver dør er
  lysåpningen / 2 + 10 (overlapp) + 10 (skinnespor) bred: 500 i lysåpning 960, 375 i 710 og 250 i 460, og like høy
  som platen ville vært. En dør skjøvet helt inn i sporet går da fortsatt 10 forbi midten. Den andre døren står rett
  innenfor den første, så de glir forbi hverandre. Skinnene står, også bunnskinnen. Ikke på deler på 250: «Skyvedør går
  ikke på en del på 250». Lås er ikke bygget. Døren står i én lysåpning (K16) og er like høy som platen der. I planen er delen hel
  strek med to korte streker innenfor for dørene. Tid, plassholder: 2 min opp og 1 ned per skyvedør (Bjørn
  13.11.2026). Tilbudet sier «1 skyvedør», én per lysåpning med dør.
  *Bjørn 13.11.2026 · kode `src/foga/counter.ts` (`doorLeaves`), `src/domain/podiumFaces.ts` (`takesDoor`) · test `src/domain/podiumFaces.test.ts`, `src/calc/podium.test.ts`*
- **K18 Høyde per seksjon.** Høyden på en seksjon som står, endres i skuffen (CC 250, 500, 750 eller 1000) eller ved å
  dra toppen av seksjonen i risset (grepet «CC 750») eller i 3D (de øverste 80 mm av seksjonen, pekeren viser ↕);
  draget snapper til de samme fire høydene, vises mens det dras og settes når det slippes. I 3D regnes draget fra
  skissen ved trykket, så hyller en lavere høyde tok bort, kommer tilbake om toppen dras opp igjen før slipp. Bygget følger K12: trinnplate og 94 under den lave toppen mot en høyere nabo. Valget på delene
  (K16, K17) står. Hyller i eller over den nye høyden fjernes, og hintet i skuffen sier hvor mange.
  *Bjørn 13.11.2026 · kode `src/domain/podiums.ts` (`setSectionHeight`), `src/ui/plan/podiumDrawer/PodiumElevation.tsx`, `src/ui/scene3d/pointer/drag.ts` (`podiumTopAt`) · test `src/domain/podiumFaces.test.ts`, `src/ui/scene3d/pointer/drag.test.ts`*
- **K19 Hylle i disk.** En hylle hører til en seksjon og står i CC 250, 500 eller 750, lavere enn seksjonens høyde.
  Det er ingen fri høyde. Bygget som midtskinnen i 6560 (K3, K5): fire skinner rundt seksjonen med underkant i
  CC-høyden, 93 på utvendige kanter og 94 mot en naboseksjon, og MDF 6 mm i falsen med overkant 36 over skinnens
  underkant, like stor som toppen. To naboseksjoner med hylle i samme høyde deler 94-skinnen mellom seg. Skinnen står
  også der delen er åpen eller har skyvedør. Mot en lavere nabo står skinnen over den lave toppen som 93 vendt mot
  den, og trinnplaten deles ved den; i høyde med den lave toppen er 94-en under toppen nok. Hyllene slås av og på i
  skuffen (for seksjonen bak delen, eller alle langs siden) og dras opp og ned i risset med grepet «Hylle 500»: draget
  snapper til CC-høydene og stopper mot en nabohylle og mot toppen. Risset målsetter hyllene fra gulv i CC. To
  seksjoner slås bare sammen (K14) med like hyller; et grep som legger på seksjoner gir dem hyllene til seksjonen det
  strekker. Tid, plassholder: 1,5 min opp og 1 ned per hylle (som H7, Bjørn 13.11.2026), unntatt hyllen i CC 750 i en
  seksjon som er 500 dyp: den er med i tiden per seksjon (K9), som i 6560. Tilbudet sier «3 hyller».
  *Bjørn 13.11.2026 · kode `src/foga/counter.ts` (`shelfRails`), `src/domain/podiumShelves.ts` · test `src/domain/podiumShelves.test.ts`, `src/calc/podium.test.ts`*
- **K20 Print og dekal på disk.** På plate og skyvedør, aldri på åpen lysåpning, trinnplate eller del mot vegg eller
  annen disk (valget står og kommer tilbake når disken flyttes ut). Print er heldekkende dekal, ikke trykk på platen, og
  dekker platene og dørene i delen mellom stolpene og skinnene. Deler på rad på samme side med samme motiv viser ett
  motiv strukket over dem (som `printWall`): bildet dekker fra første dels venstre stolpe til siste dels høyre og fra
  bunnskinnen til den høyeste toppen, beskåret, aldri strukket ut av form. En dekal har mål og plass på delen (fra
  midten av seksjonens side, sett utenfra) og flyttes og skaleres i risset som på vegg, holdt innenfor delen. Print
  tar bort dekalene på siden, og en dekal tar bort printen. Fargen er diskens (K6): en farge valgt i paletten tar
  printen av det som er valgt (siste strøk vinner), og malerspannet farger hele disken eller printer alle delene som
  kan ta det. Vist i risset, i planen (en tynn stripe av motivet innenfor ytterkanten) og i 3D. Print prises på eget
  artikkelnummer 8023 «Foliedekor, diskfelt» per m², med målene som kuttes på linjen («2 × 960 × 960 mm»), dekal som m²
  dekal (8020) og en oppstart per print strukket over flere deler (8022).
  *Bjørn 13.11.2026 · kode `src/domain/podiumDecor.ts`, `src/calc/lines/decor.ts` · test `src/domain/podiumDecor.test.ts`*

- **K22 6560 i Disker og podier.** Bardisk 6560 er et ferdig oppsett i Disker og podier: én seksjon 1000 × 500 c/c,
  CC 1000, hylle i CC 750 og baksiden åpen i begge lysåpningene, bygget nøyaktig som disken på lager (K1–K5). Så lenge
  disken er dette, er den lagervaren: katalogpris 6560 (1320 kr), kostet som én disk, plukket hel som 1 stk, og navnet
  «Bardisk». Farge (K6), print og dekal (K20), snudd, flyttet og mot vegg eller annen disk er fortsatt 6560. Annen
  lengde, dybde, høyde eller hylle, skyvedør, en annen åpen side eller sammenslåing (K15) gjør den til spesialbygg
  (K13). Pennen velger etter funksjon (Bjørn 14.11.2026): «Fri» (en seksjon på 500 × 500 per klikk), så én knapp per
  undergruppe i katalogen som har en standardvare, «Disk» og «Podie», med omrisset av varen bak. Bak hver funksjon står
  varen som sist ble hentet fra katalogen for den, i starten den første (for Podie den i høyden Fri har). Et klikk med
  «Disk» setter disken med fronten mot den åpne siden av standen på tvers av den (den nærmeste når begge er åpne); med
  «Podie» setter det podiet rett (dreiet 0), i høyden valgt i pillen, som velger varen. Ingen av dem bygger på en disk
  det peker ved. Høydene varen ikke finnes i, og «Fin», er grå mens en funksjon er i hånden; å dra tegner alltid fritt.
  Bardisk 6560 i Utstyr er det samme: + setter en 6560 fra Disker og podier, og penselen der legger varen bak sin
  funksjon og i hånden.
  En skisse lagret før dette gjør disker fra Disker om når den åpnes: disken på lager blir 6560, en tegnet disk én
  seksjon per hel eller halv meter, åpen bak og med hylle i CC 750, bygget og priset likt. Verktøyet Disker finnes ikke
  lenger (K7).
  Podie 50 × 50 (5450) er en standardvare på samme måte (Bjørn 14.11.2026): én tett seksjon 500 × 500 uten hylle, og
  hver høyde er sin egen variant med egen pris: 25 cm (CC 250) 5450-4, 50 cm 5450-1, 75 cm 5450-2 og 100 cm 5450-3. Et
  varenummer skifter aldri betydning, så 25 cm, som kom sist, fikk det siste nummeret; katalogen viser dem etter høyde.
  Det som er tegnet fritt og bygget nøyaktig som en standardvare, *er* den varen: et klikk med «Fri» setter en seksjon
  500 × 500 i pennens høyde, og det er et Podie 50 × 50 til katalogpris. Alt som er tegnet fritt og ikke er nøyaktig en
  standardvare, er spesialbygg (K13). Podie 50 × 50 i Utstyr virker som 6560 (+ setter et podie i variantens høyde). En
  skisse lagret før dette gjør talte podier om når den åpnes: ett podie per stykk der + ville satt det, i høyden
  varenummeret alltid har betydd; et podie som ikke får plass, blir stående talt. Navnet i pille og skuff er
  katalognavnet med varianten, uten varenummer: «Bardisk», «Podie 50 × 50, 75 cm». Ferdig bygget kostes hver
  standardvare som én leid vare (`ITEM.counter` per utvendig mål og høyde).
  *Bjørn 13.11.2026 · kode `src/domain/podiumStock.ts`, `src/domain/podiums.ts`, `src/calc/lines/objects.ts`, `src/persistence/file.ts`, `src/ui/panel/sections/EquipSection.tsx`, `src/ui/podiumPen.ts` · test `src/domain/podiumStock.test.ts`, `src/ui/podiumPen.test.ts`*

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

Bestemt eller nevnt, men ikke i koden: støttevaier fra hallens tak i stedet for fotplater (samme regel som S3), tekstildør
med overstykke, høye tekstilvegger, systemvegg på cc 250, 500 og 750 (delene finnes), og endring av standvegg med
nabogodkjenning. Samba-duk foran LED (appen tegner ikke LED ennå).
