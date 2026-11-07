# Byggeregler

Alle byggetekniske regler appen følger, med nummer, én gang. Hver regel sier hva som gjelder, hvem som bestemte den og
når, hvor verdiene står, hvilken kode som gjør det og hvilken test som passer på det. Bakgrunn, mål og tverrsnitt står
i [foga-system.md](foga-system.md), veggbegrepene i [vegger.md](vegger.md), pris og tid i [prismodell.md](prismodell.md).

## Slik brukes registeret

- **Nummeret er regelens navn.** Bokstaven er området (V vegg, S støtte, T takdrager, D dør, R rom, X tekstil, G gulv,
  P plukk, B hvem bygger). Et nummer brukes aldri om igjen: en regel som faller bort, blir stående som «utgått».
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
  Fysisk lengde er cc pluss én stolpe: 4000 c/c er 4040. Veggpenselen tegner hele moduler.
  *Bjørn 31.10.2026 og 6.11.2026 · `rules.wall.cc`, `rules.wall.post` · kode `src/domain/walls.ts` · test `src/foga/engine.test.ts`*
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
  *Bjørn 3.11.2026 · kode `src/calc/wallSupports.ts` · test `src/calc/supportBeams.test.ts`*
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
  *Bjørn 31.10.2026 · `rules.beam.max` · kode `src/calc/beams.ts` · test `src/calc/calc.test.ts`*
- **T3 Standard takdrager.** Legges langs de åpne sidene av standen. En ende mot en vegg deler veggens stolpe.
  *Bjørn 31.10.2026 · kode `src/calc/beams.ts` · test `src/calc/calc.test.ts`*
- **T4 Vegg deler drageren.** Der en vegg møter eller krysser en takdrager, også enden av en inner- eller romvegg, deles
  drageren og deler veggens stolpe. Hver side er egen lengde etter T2.
  *Bjørn 1.11.2026 · kode `src/calc/beams.ts` · test `src/calc/calc.test.ts`*
- **T5 Tverrdrager.** Fra hver 6 m-skjøt går en tverrdrager inn til motstående vegg eller side. Den går videre forbi en
  vegg som møter eller krysser den, delt på veggens stolpe, og stopper bare der en vegg går langs linjen.
  *Bjørn 1.11.2026 · kode `src/calc/beams.ts` · test `src/calc/calc.test.ts`*
- **T6 Følger standveggene.** En øy har ingen standvegger og får ingen standard takdrager, men kan slå dem på. Kunden kan
  velge bort takdragerne (`Variant.noBeams`); da står veggene fritt (S2).
  *Bjørn 1.11.2026 og 3.11.2026 · kode `src/domain/walls.ts` · test `src/calc/supportBeams.test.ts`*
- **T7 Støttedrager.** En standvegg med et fritt spenn på 6 m mellom to punkter som holder den (hjørne, T, en takdrager
  som hviler på den) får én støttedrager 3 m fra hjørnet. Den går rett inn til det første den møter, en vegg eller en
  takdrager: deler stolpen på en vegg eller stolpe, henger på krok på lengden av en drager, og stopper foran en vegg
  langs linjen. Et lengre spenn får én per 6 m. Den er en standard takdrager. Uten takdrager blir det fotplater (S2).
  *Bjørn 3.11.2026 · `rules.beam.supportSpan` · kode `src/calc/supportBeams.ts` · test `src/calc/supportBeams.test.ts`*
- **T8 Innvendig takdrager.** Tegnes av kunden, rett og i hele meter innenfor standen, aldri langs en vegg eller oppå en
  annen takdrager. Samme profil, høyde og deling (T1, T2) som standard.
  *Bjørn 1.11.2026 · kode `src/domain/innerBeams.ts`, `src/calc/innerBeams.ts` · test `src/domain/innerBeams.test.ts`*
- **T9 Krok.** En ende som treffer en annen takdrager henger på den med krok: ingen stolpe der, og drageren den henger
  på deles ikke. Kroken er toveis, én per krokpunkt. Art.nr. mangler (plassholder `KROK`).
  *Bjørn 1.11.2026 · `RECIPES.beam.hook` · kode `src/calc/innerBeams.ts` · test `src/calc/innerBeams.test.ts`*
- **T10 Kryss.** Der to tegnede takdragere krysser, går det lengste spennet gjennom og det korteste deles og henger på
  krok på hver side. Like lange: den først tegnede går gjennom. En tegnet drager som krysser en standard deles likt.
  *Bjørn 1.11.2026 · kode `src/calc/innerBeams.ts` · test `src/calc/innerBeams.test.ts`*
- **T11 Vegg langs drageren vinner.** Havner en vegg (innervegg, romside, dør, standvegg) langs en tegnet takdrager,
  bygges ikke den biten. Drageren stopper på veggens stolper, veggen regnes ikke som holdt av den, og drageren kommer
  tilbake når veggen flyttes bort. Over et rom er lov: drageren hviler på romveggene.
  *Bjørn 1.11.2026 · kode `src/calc/innerBeams.ts` · test `src/calc/innerBeams.test.ts`*
- **T12 Egne stolper.** En tegnet takdrager har stolper bare i frie ender og 6 m-skjøter, og ingen tverrdrager. Under
  hver egen stolpe står fotplate 750 med 795 på tvers av drageren; den faller bort der en drager fra den andre retningen
  (tegnet eller støttedrager) møter stolpen.
  *Bjørn 1.11.2026 · kode `src/calc/innerBeams.ts`, `src/calc/beams.ts` · test `src/calc/innerBeams.test.ts`*
- **T13 Over tekstilvegg.** En takdrager kan ikke kobles på en tekstilvegg (InFrame eller frittstående, begge 43TX).
  Tar drageren og en tekstilramme som når opp til dragerens underkant samme plass i plan, heves hele løpet (lengdene i
  samme rette linje som møtes ende mot ende) 80 mm. Gjelder alle takdragere. Bare fysisk konflikt teller, ikke innsyn.
  *Bjørn 6.11.2026 · `RECIPES.beam.lift` · kode `src/calc/beamLift.ts` · test `src/calc/beamLift.test.ts`*
- **T14 Skjøt.** Hver stolpe et hevet løp hviler på, også en veggstolpe, får 94 × 80 med 609 ned i stolpen. Der en hevet
  drager henger på en som ikke er hevet, eller omvendt, står samme stykke med 600 mot den andre drageren, i høyden til
  drageren som henger der.
  *Bjørn 6.11.2026 · `RECIPES.beam.lift` · kode `src/calc/beamLift.ts` · test `src/calc/beamLift.test.ts`*

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
  *Bjørn 31.10.2026, 6.11.2026 og 7.11.2026 («frittstående er InFrame på fotplater») · kode `src/domain/textile/brush.ts` · test `src/domain/textileBrush.test.ts`*
- **X2 Ramme på systemvegg.** Bredde = spenn − 20 − 10 (sentrert i spennet), høyde 2540 eller tekstilens egen. 43TX gjæret,
  2B + 2H, 617 i alle fire hjørner, festet med 2 × 520 (med 503) til stolpe 94. Stående stag i 90 maks 2000 fra hverandre
  (rammesidene teller), lengde H − 80, med 600 i hver ende: duken trekker mest på midten.
  *Bjørn 31.10.2026 (fabric.js er fasit), stag 2 m 7.11.2026 · `rules.textile.inFrame`, `RECIPES.frame` · kode `src/calc/textile/inFrame.ts` · test `src/calc/fabric.test.ts`*
- **X3 Trykkfil.** Ramme + 2 × bleed (20), levert i 10 %.
  *Bjørn 31.10.2026 · `rules.textile.inFrame` · kode `src/calc/textile/inFrame.ts` · test `src/calc/fabric.test.ts`*
- **X4 Plass på veggen.** InFrame står aldri over en åpning og overlapper ikke en annen på samme side. Standvegg har bare
  innsiden, innervegg og romvegg begge. To InFrame-rammer kobles ikke sammen.
  *Bjørn 30.10.2026 · kode `src/domain/textile/inFrame.ts` · test `src/domain/decor.test.ts`*
- **X5 På fotplater (frittstående).** Samme ramme som X2, på fotplater, med tekstil på begge sider (trykt, hvit eller kundens egen), høyde 2540, minst
  0,25 m. Tegnes på rutenettet 25, 50, 75 eller 100 cm. Ikke langs eller gjennom en systemvegg (helt inntil er lov). Den
  lager ikke rom og kan ikke ha dør.
  *Bjørn 31.10.2026 · `rules.textile` · kode `src/domain/textile/free.ts` · test `src/domain/freeTextile.test.ts`*
- **X6 Skinner.** Gjelder rammen uansett montering. Topp- og bunnskinne går hele rammen; over 5000 skjøtes de i like stykker. Skjøten er 2 × 609 per
  skjøt (tres inn, krever plass i enden), eller 4 × 604 i sporet når begge ender er holdt av en vegg, en ramme på vegg
  eller en 92LTX, så profilen ikke kan tres. Stående 43TX i hver fri ende, 617 i hvert hjørne. En ramme på
  systemvegg settes sammen før den henges opp, så den skjøtes med 609.
  *Bjørn 31.10.2026, skjøt 7.11.2026 · `RECIPES.freeFrame` · kode `src/calc/textile/free.ts`, `src/calc/textile/inFrame.ts` · test `src/calc/freeFrames.test.ts`, `src/calc/fabric.test.ts`*
- **X7 Hjørne.** To frittstående vegger møtes bare ende mot ende i rett vinkel (ingen T) og deler en 92LTX, kappet
  2526 (endelokk 7 mm under og over, ikke plukket). Skinnene stopper 37 mm før hjørnepunktet; utvendig duk er 20 mm
  lengre og innvendig 20 mm kortere per hjørne. En strek i forlengelsen blir samme vegg.
  *Bjørn 31.10.2026 og 6.11.2026 · `RECIPES.freeFrame` · kode `src/calc/textile/free.ts`, `src/domain/textile/free.ts` · test `src/calc/freeFrames.test.ts`*
- **X8 Føtter og stag.** Fotplate 740 under bunnskinnen etter S3 og S4; en 92LTX teller som støtte. Stagene er rammens
  egne (som X2) og står uavhengig av føttene: en fotplate har ikke stag.
  En fot i en fri ende står i flukt med rammeenden (200 mm inn for 740), resten jevnt fordelt. Under 1 m: én 730 midt på.
  Ett stag 150 mm (100–200) fra hver side av en skinneskjøt, så det virker som rammeside når lange motiver monteres i
  seksjoner. Ellers jevnt fordelt, så ingen stående (rammeende, 92LTX, stag) står mer enn 2000 fra hverandre.
  *Bjørn 1.11.2026, 3.11.2026 og 7.11.2026 · `RECIPES.freeFrame.maxBrace`, `spliceBrace` · `RECIPES.freeFrame.support` · kode `src/calc/textile/free.ts`, `src/calc/supports.ts` · test `src/calc/freeFrames.test.ts`*

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
  *Bjørn 1.11.2026 · `rules.floor.cell` · kode `src/domain/floor/tiles.ts` · test `src/domain/floor.test.ts`*
- **G2 Auto og fast størrelse.** Auto legger 1 × 1 der den passer, ellers den største flisen som passer, og kutter aldri.
  En fast størrelse dekker det som ligger der og kutter fliser som bare delvis dekkes.
  *Bjørn 1.11.2026 · kode `src/domain/floor/brush.ts` · test `src/domain/floor.test.ts`*
- **G3 Engangsteppe.** Legges i baner fra en rull 2 m bred, lengde i 0,5 m, langs standens lengste side som standard
  (kan snus). Siste bane kappes på langs. 10 cm ekstra i hver ende; avkappet er alltid svinn. Kunden betaler lagte m²,
  plukklisten har løpemeter fra rullen og teip langs omriss og skjøter.
  *Bjørn 1.11.2026 · `rules.floor.rollEnd`, katalogens `roll` · kode `src/domain/floor/lanes.ts` · test `src/domain/floor.test.ts`*
- **G4 Fyll.** Fyll foreslår hvordan rullen kappes og legges over et område, rangert etter intern kost (materiale, teip,
  arbeid; satsene er forslag). Deling på langs finnes bare som forslag fra Fyll.
  *Bjørn 1.11.2026 · `rules.carpet` · kode `src/domain/floor/rollFill.ts` · test `src/domain/carpet.test.ts`*
- **G5 Under rom og vegger.** Gulvet legges under rom og vegger.
  *Bjørn 1.11.2026 · kode `src/domain/floor/lanes.ts` · test `src/domain/floor.test.ts`*

## P · Plukkliste og arbeidsordre

- **P1 Ferdige enheter.** Det som lagres ferdig montert, plukkes som stk: stolpe 94 med fot eller uten fot, fotplate 750
  med 795, topp- og bunnskinne med 600, takdrager per lengde med 600, støttestag 90 med 600, dørblad og skjøt 94 × 80
  med 609 eller 600.
  *Bjørn 31.10.2026 · kode `src/foga/engine.ts` · test `src/foga/engine.test.ts`*
- **P2 Løse deler.** Uten ferdig enhet plukkes delene: 43TX per kappelengde, 92LTX, 617, 609, 604, 520, 740, 730 og krok.
  *Bjørn 31.10.2026 · kode `src/foga/engine.ts` · test `src/calc/freeFrames.test.ts`*
- **P3 Faktisk antall.** Plukklisten teller artiklene i tegningen (moduler som møtes deler stolpe), ikke det salgsproduktet
  regner med per meter.
  *Bjørn 31.10.2026 · kode `src/foga/fromVariant.ts` · test `src/calc/calc.test.ts`*
- **P4 Arbeidsordre.** Arbeidsordren er plukklisten montøren får: uten art.nr. for Foga-deler og uten bestanddelene i
  ferdige enheter.
  *Bjørn 2.11.2026 · kode `src/ui/workorder/WorkOrderPage.tsx` · test `src/foga/engine.test.ts`*

## B · Hvem bygger

- **B1 Arrangørens standvegger.** Betaler arrangøren standveggene, bygger arrangøren dem og standard takdragerne (med
  stolpene bare de trenger, og støttedragerne). De er da ute av utstillerens tilbud, plukkliste og arbeidsordre. En
  stolpe i arrangørens standvegg er arrangørens, også når en innervegg står inntil. Detaljer i [vegger.md](vegger.md).
  *Bjørn 31.10.2026 · kode `src/calc/context.ts` · test `src/calc/supportBeams.test.ts`*
- **B2 Alltid utstillerens.** Innvendige takdragere, fotplater (også under arrangørens vegger), skjøt over tekstilvegg og
  platebytte i en standvegg bygges og betales av utstilleren. En øy uten standvegger: utstilleren betaler takdragerne.
  *Bjørn 31.10.2026, 1.11.2026 og 6.11.2026 · kode `src/calc/context.ts`, `src/calc/lines/beams.ts` · test `src/calc/innerBeams.test.ts`*

## Ikke bygget ennå

Bestemt eller nevnt, men ikke i koden: støttevaier fra hallens tak i stedet for fotplater (samme regel som S3), tekstildør
med overstykke, høye tekstilvegger, systemvegg på cc 250, 500 og 750 (delene finnes), og endring av standvegg med
nabogodkjenning. Samba-duk foran LED (appen tegner ikke LED ennå).
