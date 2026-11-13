# Kodekart: hvor koden for hvert produkt ligger

Startpunkt for en endring på ett produkt. Oppdateres i hvert trinn av ryddeplanen (november 2026), slik at kartet alltid
stemmer med koden. Begreper: [vegger.md](vegger.md), byggereglene nummerert: [byggeregler.md](byggeregler.md) (koden viser til nummeret, `src/test/byggeregler.test.ts` holder dem i takt), Foga-bakgrunn: [foga-system.md](foga-system.md), priser:
[prismodell.md](prismodell.md), kost: [kostmodell.md](kostmodell.md), tegnspråket i plan, veggriss og tilbud: [arbeidstegning.md](arbeidstegning.md), forhåndsvisning mens man tegner: [forhandsvisning.md](forhandsvisning.md), pille og skuff for valgt objekt: [pille-og-skuff.md](pille-og-skuff.md).

## Lagene

Alt avledes fra modellen (`Variant` i `src/domain/types.ts`). Rekkefølgen er alltid den samme:

| Lag | Mappe | Hva |
| --- | --- | --- |
| Modell og redigering | `src/domain/` | Datatypene og rene funksjoner som endrer en variant. Id-er: `ids.ts` |
| Regler | `src/rules/rules.ts`, `src/foga/recipes.ts` | Mål, rutenett, oppskrifter og støtteregler |
| Kalkyle | `src/calc/` | `calc.ts` kjører linjeblokkene per produkt (`lines/*`, `textile/lines.ts`) på felles kontekst (`context.ts`); `summary.ts` gir grupper, margin, nøkkeltall og BOM. Typene i `types.ts`. Posisjonsnummer (ett per artikkel, samme på tilbud og tegning): `positions.ts`, med tester |
| Stykkliste | `src/foga/` | Foga-strukturen og BOM, grunnlaget for plukklisten |
| Pris | `src/pricing/` | Prismodellen: hvordan en linje prises (`model.ts`: `priceLine`, `sumItems`) og prisene kalkylen bruker, regnet fra aktivt kostgrunnlag (`data.ts`: `pricingFrom`). Her skal en prisliste fra OMS leses inn. Henter fra `cost/`, aldri omvendt |
| Kost | `src/cost/` | Kostmotoren ([kostmodell.md](kostmodell.md)): leverandørens prisliste (`prices.ts`; eksempelpriser i `example-list.ts`, den ekte Foga-listen publiseres ikke), tallene (`params.ts`) og de seks reglene for kost og pris fra DG (`model.ts`, med tester). Kostgrunnlaget som fil med versjon (`basis.ts`, med tester), lagret i nettleseren (`persistence/storage.ts`), aktivt i `ui/env.ts` (`costBasis`), lastet inn fra kortet (`ui/costbasis/CostBasisCard.tsx`) på siden Kostgrunnlag (`ui/costbasis/CostBasisPage.tsx`, fanene i `Explain.tsx`, `References.tsx` og `History.tsx`): hvert tall som felt med sti, status, kilde og dato (`fields.ts`: `basisFields`, `withValues`, med tester), byggereglene og formlene ved siden av (`ui/costbasis/rows.ts`). En sti i «Slik er det regnet» åpner siden på radene den peker på (`ui/costbasis/link.ts`). Redigering i ark og versjoner (`ui/costbasis/Edit.tsx`, `cost/history.ts`, historikken i `ui/env.ts`), referansestandene før og etter en endring (`calc/referenceSet.ts`). Tid per håndteringstrinn (`time.ts`: `Time`, `HANDLING_STEPS`, `addTime`), prisartikkelen som type (`PriceItem` i `items.ts`). Prisartiklene (`cost/itemDefs.ts`: `ITEM_DEFS`, og eksempeltallene `EXAMPLE_TIMES`, `EXAMPLE_RECIPES`, `EXAMPLE_CATALOG` som kostgrunnlaget fyller inn) får kost og pris fra motoren i `items.ts`, katalogprodukter uten oppskrift kost og tid fra `catalogOwn` i `pricing/data.ts`; `ui/env.ts` gir kalkylen `pricing` fra aktivt kostgrunnlag. Indirekte kost som egen linje under marginen i `ui/calc/CalcPanel.tsx`; trykk på en kalkylelinje åpner «Slik er det regnet» (`ui/calc/Trace.tsx`, fra `PriceItem.trace` og `CalcLine.uses`) |
| Plan | `src/ui/plan/PlanView.tsx`, `layers/`, `pointer/` | `PlanView.tsx` setter sammen lagene og markøren. Hvert produkt tegnes i sitt lag i `layers/`. Klikk og dra: `pointer/usePlanPointer.ts` velger dra-type ved trykk (pennen i hånden, eller for Velg det som ligger under pekeren, `pointer/select.ts`), og hver dra-type har sin fil i `pointer/` (`stroke`, `plates`, `floor`, `roll`, `carpetFill`, `object`, `wall`, `beam`, `room`, `textile`, `freeMove`, `click`), pluss `place` for dør, dekal og møbel: trykk viser fantomet, slipp over samme mål lagrer (klikket i `opening`, `decor`, `object`), dra bort eller Esc avbryter. Klikkreglene i Velg ([pille-og-skuff.md](pille-og-skuff.md)) ligger i `pointer/click.ts`: et klikk velger uten skuff, et nytt klikk på det samme beholder valget, og tomt gulv eller Esc slipper det. Planen har ikke dobbeltklikk, og skuffen åpnes med Mer i pillen. Et drag slipper aldri valget. Hva et valg gjelder, leses ett sted: `chosen(v, sel)` i `selection.ts` gir en union per type (vegg, dør, tekstil, dekal, hylle, rom, takdrager, møbel, frittstående, engangsteppe) med det valgte slått opp, og nøkkelen, Delete, pillen, hvor den står og skuffene bygger på den (med tester). Pillen over det som er valgt: `pill/SelectionPill.tsx`, med innholdet per type i `pill/floor.tsx` (engangsteppe), `pill/objects.tsx` (rom, takdrager, møbel, frittstående), `pill/door.tsx`, `pill/wall.tsx` (vegg, tekstil, dekal) og `pill/shelf.tsx`, felles deler i `pill/parts.tsx`; Detaljer åpner skuffen. Hvor den står i `pill/pillAnchor.ts` (borte fra standens midtpunkt for vegger, forbi totalmålene og sidenavnet ved standkanten, ellers under; holder seg unna standbrikken, minikartet og docken; med tester). `PlanView.tsx` viser den med en gang, og skjuler den mens man drar, med skuffen åpen og med en penn i hånden. Rotering av møbel og frittstående tekstil (pillen og R): `plan/turn.ts` med `rotateObject` (`domain/objects.ts`) og `rotateFreeTextile` (`domain/textile/free.ts`); bytt variant: `setObjectProduct`, og hvilke varianter som tilbys i `ui/objectFamily.ts` (samme produkt, eller samme gruppe og fotavtrykk). Tester i `domain/objectTurn.test.ts` og `domain/textile/free.test.ts`. En dør holder så lenge pekeren er der bladet kan slå (`inDoorArea`), og slagside og hengsel følger pekeren (`doorAim`/`placeOpening` i `domain/doors.ts`, med tester). Tøm har ingen pensel: `pointer/erase.ts` finner det øverste under pekeren (grafikk før vegg, dør før vegg, møbel før gulv, hele rommet) og visker det; hvert lag demper og skraverer det som skal bort (`layers/erasing.ts`, `ErasingProvider.tsx`, samme skravur som ugyldig: `HatchPattern`); vegg og takdrager går som strek via `stroke`. Treff under pekeren i `pointer/hits.ts` (med `onWallBand`: midten av en vegg velger veggen, utenfor velges tekstilen på den siden). Det et klikk i Velg ville valgt, får en svak skygge i `layers/PickLayer.tsx` (fra `picked` i `usePlanPointer.ts`), og pillen bytter mellom vegg og tekstil (`layerSwitch` i `pill/wall.tsx`). Felles farger og strektykkelser ligger i `planStyle.ts`. Forhåndsvisningen mens man tegner ([forhandsvisning.md](forhandsvisning.md)) er en dempet visning av resultatet, allerede ved peking: `next.ts` finner målet under pekeren og redigeringen et klikk eller slipp der gjør (samme domenekall som `pointer/`), App gir det den ville lagret (`ui/edits.ts`, delt med `onEdit`) og kalkylen, og `PlanView` tegner hvert lag en gang til fra neste variant med `PHANTOM`-styrke, klippet til det som endres og med det gamle skjult der (`nextArea.ts`, med tester; klipp og maske i `layers/NextDefs.tsx`). Neste variant og kalkylen regnes ut i `nextState.ts`, bare når målet endrer seg. `layers/PreviewLayer.tsx` legger til målpillen (`MeasurePill`, hvor den står i `pill/pillPlace.ts`), skravuren der det ikke går (`InvalidSeg`/`InvalidShape`), grunnen i hintlinjen via `onHint`, Tøms strek, romhåndtakene og valgte engangsteppebaner; byggesteinene i `layers/Previews.tsx`, gulvets mål i `layers/measures.tsx`, verdiene i `planStyle.ts`. `planScale.ts` gir lagene skalaen på skjermen (`u`, meter per skjermpiksel, `lw` 1,5 på dokumentene og detaljnivå `full`/`compact` under 55 px/m), så strekbredder kan oppgis i skjermpiksler (`linePx`) og tekstbredder anslås (`textPx`). Størrelsen på skjermen måles med `ui/useElementSize.ts`, også for veggrisset og 3D-bildet på tilbudet. Målkjedene: hva som måles i `dims.ts` (totaler, plasseringsrad, modulkjede for valgt vegg, med tester), lagt ut av `layers/DimLayer.tsx`; selve kjeden tegnes av `DimChain.tsx`, som veggrisset også bruker. Regel: alle mål på tegningen tegnes med `Chain`, målpillen er bare for live-tall mens man tegner eller drar ([arbeidstegning.md](arbeidstegning.md), «Mål»). Tegnforklaring og tegningshode i gangfeltet foran: `layers/Legend.tsx`. Posisjonsnummer (bare i miniplanen på Tilbud og Arbeidsordre, aldri på tegneflaten): `layers/PosLayer.tsx`, numrene fra `calc/positions.ts`, valget i `selection.ts`, og miniplanen for Tilbud og Arbeidsordre i `PlanPreview.tsx` |
| 3D | `src/ui/scene3d/build.ts`, `build/`, `Scene3D.tsx`, `pointer/` | `build.ts` kjører én del per produkt i `build/` på felles kontekst (`build/context.ts`: materialer per lag, farger, `along`); motivteksturer i `build/motifs.ts`. Foga-profilene (målte tverrsnitt) og annen geometri som er lik hver gang (justeringsfot, stolpefeste 795, 92LTX-hjørner per retning) lages én gang i `build/profiles.ts` (`shared`, `unitProfile`) og skaleres til lengden; `dispose` i `build.ts` lar den ligge. Det de tre 3D-bildene deler (renderer, størrelse, bytte av scene der den nye tegnes før den gamle kastes, så shadere og teksturer beholdes): `view.ts`. 3D-visningen `Scene3D.tsx` setter sammen kamera og peker: hva som ligger under pekeren og hvor på gulv eller veggflate i `pointer/hits.ts`, hva et trykk drar og hva et klikk velger i `pointer/drag.ts` (et drag er aldri et klikk: slipp etter drag eller rotering endrer ikke valget, så skuffen åpnes ikke), slipp fra Profilering i `drop.ts`, og det som tegnes over scenen (slippflate, lyskant på romside, demping ved hover i kalkylen) i `overlays.ts`. Miniatyren i planen: `Scene3DPreview.tsx`. Bildet øverst på tilbudet: `QuoteRender.tsx` (tegnet én gang til `<img>` så det skrives ut, numre på tekstilveggene). Lyset (himmel og sol med skygge) er felles for alle tre i `lights.ts` |
| Skjermen | `src/ui/App.tsx` | Setter sammen sidene og Standskisse. Verktøy, penn og penninnstillinger: `useTools.ts`. Tastatur: `useShortcuts.ts`, og hva Delete fjerner i `deleteSelection` (`plan/selection.ts`, med test). Båndet med varianter og nøkkeltall: `shell/SketchBand.tsx`. Nøkkeltallene (`shell/KeyFigures.tsx`) viser detaljlinjene bare når hele raden får plass på én linje (målt med en usynlig kopi); ellers vises kort rad, og et trykk åpner et kort med alle detaljer. Skuffene for det som er valgt: `plan/Drawers.tsx`. Skuffen har egen tilstand (`drawer` i `App.tsx`, `DrawerState` i `plan/selection.ts`): et vanlig valg åpner den ikke, Mer i pillen og et valg fra panelet åpner den i detalj, og den lukkes når valget ikke har skuff (`hasDrawer`). 3D åpner fortsatt skuffen ved klikk. Skuffen står i `.drawer-frame` med to høyder: kompakt (270 px) og detalj (omtrent 60 % av tegneflaten, minst 420 px). Kanten øverst (`plan/DrawerHandle.tsx`) bytter ved klikk eller drag, og Mer åpner alltid i detalj. Skuffen har to deler: innstillinger (med grafikkhylla eller dørens miniplan under, bare i detalj) og veggrisset, som fyller det som er igjen (`wd-fit`). Planen over blir kartet. Kalkylen per variant, bufret: `calcCache.ts`. Navnepillen over ikonknappene (i stedet for nettleserens title-boble): `NameTip.tsx`, én forekomst i App som leser `title` i formen «Navn · forklaring (tast)»; oppdeling og plassering i `tip.ts` (med test) |
| Skuffer og panel | `src/ui/plan/*Drawer.tsx`, `src/ui/panel/Rail.tsx` | Innstillinger per produkt. Veggskuffen: `WallDrawer.tsx` setter sammen det `wallDrawer/focus.ts` sier skal vises, delene ligger i `plan/wallDrawer/` (se Vegger). Innstillingene i skuffene og standbrikken (`panel/StandSettings.tsx`) er bygd av `Section` i `controls.tsx`: tittel i dempede versaler med verdien når innholdet ikke viser den («HELE VEGGEN · HVIT 9010»), ikonknapper til høyre, innholdet rett på flaten; valg med `FlatChoice`, valgt fyll `--chosen` (verktøy man tegner med beholder ink); en side som kan speiles (dørens slag, hjørnestandens åpne side) er verdien i tittelen og én ikonknapp. Duk og motiv: `FabricSection`, trykkfilene: `Shelf` (begge i `plan/drawerParts.tsx`). Panelet: `Rail.tsx` har stripen og fanevalget, hver fane ligger i `panel/sections/` (`WallSection`, `FloorSection`, `ProfileSection`, `EquipSection` med søk) |
| Sider | `src/ui/quote`, `workorder` | Tilbud (med trykkfilene kunden leverer og CSV-eksport av trykklisten i `quote/printCsv.ts`, filene fra `printFiles` i `calc/textile/production.ts`) og Arbeidsordre (plukkradene i `workorder/pickRows.ts`). Antakelsene for tekstilrammen redigeres på Kostgrunnlag › Regler (`costbasis/InFrame.tsx`). Produksjon og Plukkliste er fjernet (Bjørn 8.11.2026) |
| Lagring | `src/persistence/file.ts` | Filformat, versjoner og migrering |

**Ny eller endret linje i kalkylen:** finn produktets blokk i `calc/lines/` (eller `calc/textile/lines.ts`). Det som
er bygget (moduler, stolper, takdragere, fotplater, produksjon) og hvem som betaler, ligger i `calc/context.ts`.
Rekkefølgen på linjene i tilbudet er rekkefølgen blokkene kjøres i `calc/calc.ts`.

**Ny Foga-del eller ny tekstilvariant (LED, kube):** delen i `foga/parts.ts` (art.nr, snitt og slitasjegruppe
`kind`; LED og trafo får egen gruppe når levetiden er kjent). Byggereglene i oppskriften (`foga/recipes.ts`): en
dypere LED-ramme er en egen `TextileFrameRecipe` med samme form, en kube er en ny montering ved siden av `wall` og
`feet`. Rammens deler telles i `calc/textile/common.ts` (`frameParts`), så plukklisten og kalkylen følger med. I
kalkylen trenger hver løs del en prisartikkel i `cost/itemDefs.ts` (`ITEM`, `ITEM_DEFS`, og oppskrift og tid i
`EXAMPLE_RECIPES` og `EXAMPLE_TIMES`) og en plass i `LOOSE_ITEM` i `calc/textile/lines.ts`; det motoren ikke finner en
pris for, får ingen kost og merkes i kalkylen. Kjøpt til jobben (Samba-duk) legges i egne innkjøp (`cost/own-list.ts`, ekte priser bare i
kostgrunnlaget). Regel og kilde føres i `docs/byggeregler.md`.

## Per produkt

### Vegger (standvegg, innervegg, romvegg)

- Modell: `Wall` · `domain/walls.ts` (bygde moduler, standvegg, standardtakdrager av/på, vegggeometri som
  `defaultSwing`, `doorAllowed`, `isPerimeterWall`) · `domain/edit.ts` (tegne, viske, flytte, farge) · `domain/replaceWalls.ts` (nye vegger, dører, tekstil, dekaler og hyller følger med) · `domain/panels.ts` (farge per plate, `ownPlate`) · `domain/grid.ts` (moduler og nøkler)
- Kalkyle: `calc/lines/walls.ts` (vegglinjer, arrangørens standvegger) · `calc/lines/swaps.ts` (platebytte) · hvem
  som betaler: `calc/context.ts` · `foga/fromVariant.ts`
- Plan, 3D, skuff: `plan/layers/WallLayer.tsx`, tegne/viske `plan/pointer/stroke.ts`, dra `pointer/wall.ts`, farge plater på vegg som står med veggpennen `pointer/plates.ts` (klikk én plate, dra langs veggen flere; forhåndsvisning via `plan/next.ts`; tester i `plates.test.ts`) · `scene3d/build/walls.ts` (plater og dører), `scene3d/build/frame.ts` (stolper, justeringsfot, fotplater med 795) · `WallDrawer.tsx`, `drawerParts.tsx`, `elevation.tsx`
- Veggskuffens deler i `plan/wallDrawer/`: `focus.ts` (hva skuffen viser for det som er valgt: dør, ramme, dekal, hylle, felt eller hele veggen, og siden farge eller hyller; ren, med tester), `useWallTools.ts` (malingsverktøy, motiv, side og hyllepensel mellom tegningene), `panels.tsx` (panel for farge og print, tekstil, dekal, dør og feltets farge), `fittings.tsx` (Hyller og heng, valgt hylle),
  `WallElevation.tsx` (tegningen, slipp fra hyllen og hva som får henvisning), `ElevationDims.tsx` og `elevationMeasure.ts` (veggrisset: tekstil og print på siden, overskrift, modulkjede, høyder, plasseringsrad, stagkjede og henvisningslinjer, tekstilrammen slik den bygges i `textileDrawing`, med tester; kjedene med `plan/DimChain.tsx`; selve rammen med stag, skjøt og notat før motiv: `TextileFace` i `plan/elevation.tsx`, teksten i `ui/textileNote.ts`, i 3D `scene3d/build/note.ts`), `drag.ts` (dra og endre størrelse på ramme og dekal), `paint.ts`
  (malerspann og malerkost), `face.ts` (sidens navn og rom inntil)

### Takdragere

- Standard: `calc/beams/beams.ts` (`variantBeams` setter sammen alle tre) · felles for alle utleggene: `calc/beams/beamSegments.ts` (`BeamSegment`, `BeamLayout`, deling etter T2 og `onSegment`), så utleggene ikke importerer hverandre
- Innvendige (tegnet av kunden): modell `InnerBeam`, redigering `domain/innerBeams.ts`, utlegg `calc/beams/innerBeams.ts`; Shift + dra eller «Fin» i pillen (`PlanSelection.beamFine`) utenfor rasteret `shiftInnerBeam` + `dragInnerBeamFine` (`ui/drag.ts`), mållinjer `calc/beams/beamOffsets.ts` tegnet med `DimChain` i `layers/BeamLayer.tsx`, på arbeidsordren for alle (`beamMeasures`) (T15)
- Støttedrager på lange standvegger: `calc/beams/supportBeams.ts`
- Kroker i 01, enveis og toveis (der en drager henger på en annen, eller på en vegg mellom stolpene, T15): `calc/beams/beamHooks.ts`, plukk i `foga/engine.ts`, 3D i `scene3d/build/frame.ts`
- Hevet over tekstilvegg (skjøtet stolpe og krok, hel lengde over et annet nivå T16): `calc/beams/beamLift.ts` (`withJoins`), linjen `beamLiftLines` i `calc/lines/beams.ts`, 3D i `scene3d/build/frame.ts`
- Linjen og hvem som betaler: `calc/lines/beams.ts` · `calc/context.ts` (`organiserBeams`)
- Plan og 3D: `plan/layers/BeamLayer.tsx`, tegne `plan/pointer/stroke.ts`, dra `pointer/beam.ts` · `scene3d/build/frame.ts`

### Fotplater (støtteplater)

Tre filer med «support» i navnet, med hver sin jobb:

- `calc/supports.ts`: den felles regelen (minst to fra 1 m, maks 3 m mellom, en ved hver fri ende)
- `calc/wallSupports.ts`: fotplater under systemvegg som står fritt (bruker regelen)
- `calc/beams/supportBeams.ts`: støttedrager, ikke fotplater (hvor en lang standvegg trenger en takdrager)
- Også: `calc/textile/free.ts` (fotplater under frittstående tekstil), `calc/beams/innerBeams.ts` (under innvendige takdragere)
- Linjen: `calc/lines/feet.ts`

### Teppefliser

- Modell: `FloorTile` · `domain/floor/tiles.ts` (fliser og celler) · `domain/floor/brush.ts` (penselen: størrelse,
  Auto, viske) · `domain/floor/edit.ts` (kutte fliser og baner)
- Kalkyle: `calc/lines/floor.ts` (gulvlinjer, `tileCounts`, gulvbeskyttelse)
- Plan, 3D: `plan/layers/FloorLayer.tsx` (omrisset per produkt i `plan/floorOutline.ts`), pensel `plan/pointer/floor.ts` og `floorBrush.ts` · `scene3d/build/floor.ts`. Ingen skuff, bare panelet (`panel/sections/FloorSection.tsx`)

### Engangsteppe

- Modell: `FloorTile` med `roll`, `fill`, `split` · `domain/floor/lanes.ts` (baner, `rollPieces`, `rollUsage`) ·
  `domain/floor/rollFill.ts` (Fyll med forslag, `fillCarpet`, `carpetClick`) · `domain/floor/edit.ts` (snu, forlenge og
  fjerne én bane)
- Kalkyle: `calc/lines/floor.ts` (`rollLine`)
- Plan, 3D: `plan/layers/FloorLayer.tsx` (Offcut, LaneMark), pensel `plan/pointer/carpetFill.ts` (kosten: dra et område, klikk `carpetClick`) · `scene3d/build/floor.ts` · skuff `CarpetDrawer.tsx`
- Kappliste: `ui/cutList.ts`, brukt av skuffen og `WorkOrderPage.tsx`

### Tekstilvegger (43TX)

Alt tekstil ligger i to mapper: `domain/textile/` og `calc/textile/`.

- InFrame på systemvegg: modell `TextileWall` · `domain/textile/inFrame.ts` (ledige spenn, legge til, endre, flytte)
- Frittstående: modell `FreeTextile` · `domain/textile/free.ts`
- Penselen for begge: `domain/textile/brush.ts`
- Veggflater og felt (deles med folie): `domain/faces.ts` · tekstil holdes gyldig etter andre endringer i
  `fitDecor` (`domain/decor.ts`)
- Kalkyle: `calc/textile/inFrame.ts` (rammemål og trykk), `calc/textile/free.ts` (frittstående: skinner, hjørner,
  fotplater, stag `bracePoints`, skjøt 609 eller 604), holdte ender i `heldEnds` (`calc/textile/production.ts`), `calc/textile/common.ts` (full høyde, filnavn, og `FrameParts`: hva én ramme er bygget av, telt én gang og lest av både plukklisten i `foga/engine.ts` og kalkylen i `calc/textile/lines.ts`; oppskriften `RECIPES.textileFrame` har monteringene `wall` og `feet`) · linjene: `calc/textile/lines.ts`, kost og pris fra motoren via oppskriftene i kostgrunnlaget (`cost/itemDefs.ts`) · produksjonsrader:
  `calc/textile/production.ts` (lager også folierader)
- Plan, 3D: `plan/layers/TextileLayer.tsx`, pensel `plan/pointer/textile.ts`, flytte frittstående `pointer/freeMove.ts` · `scene3d/build/textile.ts`, dra i 3D `scene3d/pointer/drag.ts`
- Skuff: `WallDrawer.tsx` med `plan/wallDrawer/panels.tsx` (`TextilePanel`) og `drag.ts` (InFrame), `FreeTextileDrawer.tsx` (frittstående)

### Print, dekal og farge

- Dekal: `Foil` · `domain/decor.ts` (folie og `fitDecor`) · veggflater og felt: `domain/faces.ts`
- Print med spann og kost: `domain/print.ts` · i veggskuffen: `plan/wallDrawer/paint.ts`
- Farge per plate: `domain/panels.ts`
- Kalkyle: `calc/lines/decor.ts` (folie, print-oppsett) · `calc/lines/swaps.ts` (platebytte) · `calc/textile/production.ts` (`foilRows`)
- 3D: `scene3d/build/decor.ts` · teksturbuffer for motiver: `scene3d/build/motifs.ts` · motiver `ui/motifs.ts` · dra inn: `ui/dnd.ts` · motivpensel i planen: `plan/pointer/decor.ts`

### Rom

- Modell: `Room` · `domain/rooms.ts` · `domain/roomKeys.ts` (romveggenes id, viskede moduler og `OUTSIDE`, lest av `walls.ts`) · `domain/outline.ts` (L-, U-, T-form) · `domain/enclosures.ts` (frihåndsrom)
- Kalkyle: ingen egen, rommet gir vegger
- Plan, 3D: `plan/layers/RoomLayer.tsx` (RoomMark, håndtak), dra `plan/pointer/room.ts` · `scene3d/build/rooms.ts`, dra i 3D `scene3d/pointer/drag.ts` · `RoomLabel.tsx`

### Dører og forheng

- Modell: `Opening` · `domain/doors.ts` (sette, tegne, flytte, snu, farge) · hvor en dør kan stå og hvilken vei
  den slår som standard: `domain/walls.ts` · `domain/rooms.ts` (dører som følger rommet)
- Kalkyle: `calc/lines/doors.ts` (også `openingKey`, artikkelen en dør går på, som posisjonsnummerene bruker)
- Plan, 3D, skuff: `plan/layers/WallLayer.tsx` (OpeningMark), pensel `plan/pointer/opening.ts` · `scene3d/build/walls.ts` · `WallDrawer.tsx` (`DoorPanel` i `plan/wallDrawer/panels.tsx`), `DoorMap.tsx`, `DoorSettings.tsx`

### Hyller

- Veggtilbehør (hyller nå, heng senere; festes likt med lås i 94-stolpenes kanal, Bjørn 9.11.2026): `domain/fittings.ts`
  (hvor tilbehør kan stå `fittingBlocked` H1/H6, stolpene `modulePosts`, feltene fra midten `fittingFelts`). Heng får
  sin egen mappe ved siden av `domain/shelves/` og bruker de samme reglene.
- Modell: `Shelf` (vegg, side, felt, høyde over gulv) · `domain/shelves/`: `model.ts` (hyllene på en side og i et felt,
  høyde og lysmål, raden `shelfRow`, `offRow`, brettet i planen `shelfBox`,
  sidene med hyller `shelfFaces`), `edit.ts` (legge til `addShelf` og `addShelfRow` med høyden fra `penHeight`, en til
  (eller en rad til) `addShelvesAbove`, i et felt `addShelfToFelt`, raden flyttes, dras og slettes samlet med `moveShelves`,
  `dragShelves` og `removeShelves`, flytte eller kopiere til et felt `placeShelves`, kopi i nærmeste ledige felt
  `copyShelvesNear` (med stabelen: `feltShelves`), `spreadShelves` (Fordel jevnt), `fitShelves` etter hver redigering i
  `ui/edits.ts`), `fill.ts` (fylle en hel side fra skuffen: `addShelfToFace` felt for felt, rad for rad,
  `addShelfRowToFace`), `corners.ts` (hvor en hylle kan stå `shelfBlocked`, også i innvendige hjørner og T-kryss
  `feltCorner`; hvilken plate hver hjørnehylle får og 01-skinnene `cornerLayout`, skinnelengdene `railLengths`, alt utledet
  av hyllene som er tegnet), `brackets.ts` (knekter, plater og skinner `shelfBrackets`) · verdiene i `rules.shelf` og
  `RECIPES.shelf` (hjørner: `RECIPES.shelf.corner`), reglene H1–H12 i [byggeregler.md](byggeregler.md). Tegnet: platen
  langs veggen `shelfSpan`, knektene sett forfra `bracketSpans` (`ui/plan/shelfFront.ts`), skinnene `FaceRails` i
  `ui/plan/elevation.tsx` og `railBox` i planen, 3D i `scene3d/build/shelves.ts`, hjørnene på arbeidsordren `CornerNotes`
  (`ui/workorder/ShelfElevation.tsx`). Eksempel: `src/test/fixtures/12-hjornehyller.json`. Hyllene følger veggen i `replaceWalls` (`domain/replaceWalls.ts`) og `moveWall` (`domain/edit.ts`) og rommet
  i `domain/rooms.ts`
- Kalkyle: `calc/lines/shelves.ts` (6311, fast pris per hylle, kost fra knektene, platene, monteringen og vareplukk én
  gang per ordre, prisartiklene i `cost/itemDefs.ts`) · plukklisten: `shelves` i `foga/structure.ts`, linjene i
  `foga/engine.ts` (gruppen Hyller)
- Plan: penselen `{ kind: 'shelf' }` hører til sitt eget verktøy Hyller (`fitting` i `ui/tools.ts`, H i verktøylinjen, hurtigvalget i `plan/QuickPicks.tsx`, raden i
  `panel/sections/EquipSection.tsx`) · klikk og rad `plan/pointer/shelf.ts`, forhåndsvisningen `shelfTarget` i
  `plan/next.ts` · tegnet `plan/layers/ShelfLayer.tsx` (en stabel som ett brett med antallet, ×3; flaten `shelves` i `plan/nextArea.ts`) · treff `shelfAt` i
  `plan/pointer/hits.ts`, brukt av Velg (`select.ts`: veggens bånd velger veggen, brettet foran hyllen; dra og Alt + dra
  i `shelfMove.ts`) og Tøm (`erase.ts`) · høyden
  på brettet ved full detalj (viker når veggen selv er valgt) · målkjeden for valgte hyller utenfor brettene
  (`planDims` i `plan/dims.ts`, veggens kjede bare når veggen selv er valgt) · valgt som `shelfId` på veggen, med raden
  unntatt `shelfOnly` (`chosenShelves` i `plan/selection.ts`, brukt av plan, skuff og 3D), pillen i
  `plan/pill/shelf.tsx` (Ned/Opp, Høyde med hurtigvalgene, Hylle til, Kopier, Bare denne); det pillen og skuffen gjør
  med valgte hyller i `plan/shelfActions.ts`
- Skuff: «Hyller og heng» i `plan/wallDrawer/fittings.tsx` (én seksjon per slag tilbehør: `FeltFittings` for et felt, `WallFittings` for hele siden; heng får sin seksjon her) og `ShelfPanel` der (Hylle til, Kopier, Kopier feltet, Fordel jevnt; hyllene i feltet velges i veggrisset), og et felt valgt ved klikk på en plate i veggrisset (`felt` i `PlanSelection`, `FeltPanel` i `panels.tsx` for siden Farge og profilering (platefarge, Print; Dekal i Profilering), `FeltFittings` for Hyller og heng, byttet med `FeltPage`, ← → bytter felt, spann og kost slipper feltet; søppelbøtta `clearFelt`), tegnet
  `ShelfFront` med usynlig gripeflate (`plan/elevation.tsx`), hyllepensel i veggrisset `plan/wallDrawer/shelfBrush.ts` (peker) og `BrushPreview.tsx` (dempet hylle, skravur, pille) med høyden og strøket i `domain/shelves/brush.ts` (`brushHeight`, `paintShelves`; med Shift `stackFelt`, `spreadFelt`), dra og Alt + dra `useShelfDrag` (`plan/wallDrawer/drag.ts`), høydekjedene `shelfChains` (`elevationMeasure.ts`, tegnet i
  `ElevationDims.tsx`)
- 3D: `scene3d/build/shelves.ts` (plate med usynlig gripeboks `shelf-grip`, 91F og 91FF fra omrisset i
  `build/profiles.ts`) · dra og Alt + dra i `scene3d/pointer/drag.ts`
- Arbeidsordre: `workorder/ShelfElevation.tsx`, ett veggriss per side fra `shelfFaces`
- Eksempelskisse: `src/test/fixtures/11-hyller.json`

### Disk (bardisk 6560)

- Oppskriften: `RECIPES.counter` (`foga/recipes.ts`), og hver profil, plate og topp med mål og plass i `foga/counter.ts`:
  `layoutBuild(recipe, layout)` bygger en disk av deler (`CounterLayout`: deler mellom knutepunkter og åpne strekk),
  finner knutepunktene og velger profil etter retningene de kobler (K8); `counterBuild(recipe, shape)` er en rett disk
  (`straightLayout`, hele meter og en halv til slutt, K7), `stockCounter(size)` disken på lager (åpen bak), bygget én
  gang og delt av plan, 3D og kost (med tester). Reglene K1–K9 i [byggeregler.md](byggeregler.md). Profilene 92L og 93 i `foga/parts.ts`,
  omrisset i `scene3d/build/profiles.ts`
- Katalogen: `counter('6560', …)` i `catalog/defaultCatalog.ts` (`Product.counter`: utvendig mål, fotavtrykket følger);
  de gamle diskene 5410, 5415 og 5420 blir løse linjer i gamle skisser (`OLD_COUNTERS`, `retiredToLoose` i `persistence/file.ts`)
- Kalkyle: `calc/lines/objects.ts` (fast pris, kost fra prisartikkelen `ITEM.counter` i `cost/itemDefs.ts`, bygget av
  `counterBuild`). Plukkes hel, 1 stk (K1)
- Plan, 3D: plassert og kolliderer som et møbel (`domain/objects.ts`), omrisset (hel strek lukket, lys hårstrek åpen) fra `plan/counterOutline.ts` i `CounterShape`, delelinjene i `plan/layers/CounterLines.tsx`
  (fra `ObjectLayer.tsx`) · `scene3d/build/counter.ts` (`buildCounter` tar en `CounterBuild`, kalt fra `buildObjects`; profilen i et knutepunkt dreies etter de lukkede sidene den har, `outward`),
  profilen snudd etter omrisset med `turnedProfile` (`build/profiles.ts`). Begge tegner i diskens egne koordinater og
  plasseres og snus utenfra, så en tegnet disk bruker de samme delene
- Verktøyet Disker (`counter` i `ui/tools.ts`, D i verktøylinjen, etter Hyller): penselen `{ kind: 'counter', product, ral }`
  plasserer som møbelpennen ved klikk (`placedBy` i `tools.ts`, `pointer/object.ts`); dra tegner disk
  (`pointer/counter.ts` → `drawCounter` i `domain/counters.ts`, forhåndsvist av `counterTarget` i `plan/next.ts`). En
  tegnet disk er et møbel med `pieces` (rette biter, mm); `domain/counterShape.ts` gjør dem til deler (`layoutOf`),
  bygg (`counterBuildOf`, delt av plan, 3D og kalkyle), boksen rundt (`objectFootprint`) og det den dekker, én
  rektangel per bit (`pieceRects` → `objectBoxes` i `domain/objects.ts`, brukt av kollisjon, treff og markering, så det
  åpne hjørnet i en L er gulv), og veien mellom diskens egne koordinater og planen (`toPlan`, `toLocal`, `turn`). Endene
  en strek går ut fra er i `domain/counterEnds.ts` (`counterEnd`, vist som grep av `layers/CounterHandle.tsx`: tonet halvmeter og runde knapper for veiene som går, prøvd med `counterDraw` i `counterHover`). Om et
  møbel er en disk, sier `PlaceContext.isCounter`. Dra innover fra en fri ende korter den (`shorten`); valgt disk, og
  hver tegnet disk på arbeidsordren, får helmål med `Chain` (`counterChains` i `plan/dims.ts`, `CounterDims` i
  `layers/DimLayer.tsx`). I
  kalkylen prises en tegnet disk av kostmotoren (`drawnCounterLine`, `drawnCounterUses` i `calc/lines/objects.ts`,
  `strategy: 'sum'` gjennom `extra` i `line()`, prisartiklene `ITEM.counterProfile` … `counterCorner` i
  `cost/itemDefs.ts`, K9); delene plukkes løse: `counterParts`/`addParts` (`foga/counter.ts`) → `drawnCounterParts`
  (`domain/counters.ts`) → `FogaStructure.counters` → `bom()` i gruppen Disker (`foga/engine.ts`).
  Hurtigvalget i `plan/QuickPicks.tsx` er veggfargene og Fyll (`Palette`, som Vegg og Gulv; Fyll = `paintCounters`).
  Veggfargene som rad er én funksjon, `ralSwatches` i `plan/swatches.ts`, brukt av Vegg, Disker og pillens `Colours`.
  Pillen på en valgt disk har de samme fargene (`Colours` i `plan/pill/objects.tsx`, `setCounterRal`)
- Farge (K6): `PlacedObject.ral`, uten = som på lager (`counterRal`, `COUNTER_STOCK_RAL` i `domain/objects.ts`). Planen
  fyller disken med platefargen, 3D farger platene (`buildCounter` tar fargen). Kalkylen legger prisartikkelen
  `ITEM.counterPlates` til linjen for hver farget disk, prisen er den samme
- Neste steg: print og dekal på platene
- Tester: `foga/counter.test.ts`, `calc/counter.test.ts`, `scene3d/build/counter.test.ts`; eksempel i `src/test/fixtures/10-mobler-utstyr.json`

### Disker og podier

Eget verktøy ved siden av Disker (tast B), K10–K13 i [byggeregler.md](byggeregler.md). 6560 og diskene Disker tegner
står urørt; det nye deler bygger, omriss, 3D og kalkyle med dem.

- Modell: `PlacedObject.sections` (`CounterSection`: x og z mellom knutepunkter, mm på 250-raster, og høyden `h`), aldri
  sammen med `pieces`. Bygget: `layoutBuild(recipe, layout, 'tight')` i `foga/counter.ts` (ingen midtskinne eller hylle,
  én plate i hele høyden, høyde per del), lest via `counterBuildOf`, `sectionsLayout`, `counterLayoutOf` og
  `sectionRects` i `domain/counterShape.ts` (én boks per seksjon i `objectBoxes`)
- Pennen, ren og testet: `domain/podiums.ts` (`podiumAt`: én seksjon under pekeren, inntil vegg og standkant innen 10 cm;
  `drawPodium` og `dragSpan`: et drag fra seksjonen man trykket i; `rectSections`/`runNodes`: hele meter først, resten
  lengst unna; Shift og Fin: `grabOf`/`podiumGrab` (hvilken kant et trykk tar), `axisSpan` (rektangelet et drag gir,
  bestillingens referanse), `startDrag`, `rebaseDrag` (Shift midt i et drag); `podiumName`, `innerCorners`, `podiumSize`).
  Påbygg (PR 3): `podiumSides` (omrisset som rette sider), `ontoAt` (siden innen `ONTO` og plassen langs den), og
  `PodiumDraw.cell`/`onto`: det som legges til, i en ramme dreid som disken med knutepunkter på hele rasterenheter, og
  disken og siden det ligger mot. `PodiumAxis.fix` holder kanten mot disken fast i `axisSpan`.
- Felles geometri for seksjonene: `domain/podiumSections.ts` (`GRID`, `bounds`, `covered`, `overlaps`, `meet`: knutelinjen
  der to seksjoner møtes, `groups`: delene som henger sammen, `edgeRuns`: kanter som rette løp; brukt av pennen, grepene
  og lenkene). Grep, lenker og disk-knappene får samme skygge fra `layers/LiftFilter.tsx` (`useLift`).
- Grep på valgt disk (K14): `domain/podiumGrips.ts` (`podiumGrips`: hvor grepene står; `gripPodium`: disken etter et
  drag, med `gone`, det som fjernes; `joined` slår sammen seksjoner som får plass i én). Treff i `hits.podiumGripAt`,
  draget i `plan/pointer/podiumGrip.ts` (Velg i `select.ts` og pennen i `usePlanPointer.ts`), forhåndsvisningen
  `gripTarget` i `plan/next.ts` (`erased` skraveres), grepene tegnes av `layers/PodiumGrips.tsx`.
- Fusjon og lenker (K15): `domain/podiumLinks.ts` (`snapBeside`: en dratt disk inntil en annen; `fusePodiums`: to blir
  én; `podiumJoints`/`breakJoint`: skjøtene og å dele ved en; `podiumLinks`: ikonene for valgt disk; `inFrame`: en disks
  seksjoner i en annens ramme). Draget i `plan/pointer/object.ts` (`fuse` på draget), klikket i
  `plan/pointer/podiumLink.ts` (`hits.podiumLinkAt`, før grepene), ikonene i `layers/PodiumLinks.tsx`.
- Høyde (K12): `h` på penselen (`Brush` podium), valgt i hurtigvalget (`QuickPicks.tsx`); trinnet mellom to høyder i
  `layoutBuild` (`stepOf`: 93 i den høye høyden, 94 under den lave toppen, plate `level: 'step'`); `podiumHeights` for
  pillen og linjen i tilbudet.
  Forhåndsvisningen fryses med Shift i `usePlanPointer.ts` (`podiumFreeze`), kanten man tar tak i tegnes tykk (`grip` i
  `PreviewLayer.tsx`). Pekeren: `plan/pointer/podium.ts`, forhåndsvisningen
  `podiumHover`/`podiumTarget` i `plan/next.ts`. Verktøyet: `Brush` `podium` og `PenTool` `podium` i `ui/tools.ts`,
  docken, hurtigvalget (farger og Fyll, `paintPodiums`) og hintet
- Sider (K16, trinn 2): valget per del står på seksjonen (`CounterSection.sides`, nøklet `x-`/`x+`/`z-`/`z+`, en liste
  per lysåpning fra gulvet). `domain/podiumFaces.ts`: `podiumParts` (delene, knutepunkt til knutepunkt), `partsOn`,
  `setLight`/`setPodiumLight`, `openStretches` (de åpne strekkene byggeren og omrisset leser via `sectionsLayout`),
  `prunedSides` (i `centred`: en side som blir innvendig mister valget), `turnedSides` (`inFrame`), `keptSides` (grep:
  en del som flyttes til en ny linje blir plate), `podiumHas` (tilbudslinjen). `joined` slår bare sammen like sider.
  `domain/podiumLocks.ts`: `partLocks`/`lockedParts` (vegg eller annen disk nærmere enn 60 mm) og `placedBuild`, bygget
  slik disken står, brukt av planen (`ObjectLayer`, `counterOutline`), 3D, kalkylen (`CalcContext.place`) og plukket.
- Skuffen: `plan/podiumDrawer/` (`PodiumDrawer.tsx`, risset `PodiumElevation.tsx`, miniplanen `PodiumMap.tsx`, og
  `podiumView.ts`: sidene rundt disken med navn, siden nærmest et klikk, siden sett utenfra). Valget i
  `PlanSelection.podiumSide`/`podiumPart`; `hasDrawer` får varianten for å vite at et objekt har seksjoner.
- Katalogen: `podium('6570', …)` i `catalog/defaultCatalog.ts` (`Product.podium`, varenummer midlertidig; `counter` er
  én seksjon, så plan, pille og 3D tegner den som en disk)
- Kalkyle: `podiumLine`/`podiumUses` i `calc/lines/objects.ts` (som K9, navnet Disk eller Podium); toppene i alle mål i
  `COUNTER_BOARDS` (`cost/itemDefs.ts`) med eksempelpriser i `cost/own-list.ts`. Delene plukkes under Disker
  (`drawnCounterParts`). Eksempelskisse: `test/fixtures/13-disker-og-podier.json`

### Møbler og utstyr

- Møbler: `PlacedObject` · `domain/objects.ts` · tellevarer: `setCounted` i `domain/edit.ts`
- Kalkyle: `calc/lines/objects.ts` (møbler, tellevarer og løse linjer)
- Plan, 3D: `plan/layers/ObjectLayer.tsx`, sette/dra `plan/pointer/object.ts` · `scene3d/build/objects.ts`

## Sikkerhetsnett for refaktorering

- **Eksempelskisser:** `src/test/fixtures/*.json`, lagrede skissefiler som dekker alle produktene over.
- **Fasit:** `src/test/fixtures.test.ts` leser skissene med `parse()` og sammenligner kalkyle, tilbudslinjer,
  plukkliste, produksjon og kappliste med lagrede snapshots. Den sjekker også at hver fil lagres tilbake uendret.
  En refaktorering skal ikke endre noen snapshot. Kjør aldri `vitest -u` i en refaktorering: et avvik er en feil til
  det er forklart.
- **Skjermbilder:** `scripts/shots.mjs` tar bilder av plan, 3D, skuffer, Tilbud og
  Arbeidsordre for hver skisse, og sammenligner to bygg piksel for piksel. Kjøres for hånd på hver refaktorerings-PR:

  ```sh
  git worktree add ../eqs-main origin/main && (cd ../eqs-main && npm ci && npm run build)
  npm run build
  node scripts/shots.mjs shoot ../eqs-main/dist shots/main
  node scripts/shots.mjs shoot dist shots/branch
  node scripts/shots.mjs compare shots/main shots/branch shots/diff
  ```

  Første gang: `npx playwright install chromium`.
- **Pekerbevis:** `scripts/pointer-replay.mjs` spiller av de samme klikkene og dragene i planen på to bygg (vegg, dør,
  takdrager, rom, møbel, fliser, engangsteppe, tekstilpensel, motiv og dra inn fra Profilering, og trykk, hold og
  slipp eller Esc for dør, dekal og møbel med hjelpesteget `hold`) og sammenligner skissen som lagres, skuffen som
  åpnes, hva som er valgt (`data-selection` på planen), markøren, pennen i docken og hvor det siste møbelet står etter hvert steg. Kjøres for hånd når pekerhåndteringen i
  `plan/pointer/` endres:

  ```sh
  node scripts/pointer-replay.mjs run ../eqs-main/dist shots/ptr-main.json
  node scripts/pointer-replay.mjs run dist shots/ptr-branch.json
  node scripts/pointer-replay.mjs compare shots/ptr-main.json shots/ptr-branch.json
  ```

  Reprisen har også tastatursteg (Delete på hver type, Escape, R, angre og gjør om, verktøytastene).
- **Pekerbevis i 3D:** `scripts/scene3d-replay.mjs` gjør det samme i 3D-visningen: peker, drar fra og klikker et
  rutenett av punkter over bildet for fem skisser, og slipper motiver fra Profilering. Kjøres når `Scene3D.tsx`,
  `scene3d/pointer/` eller `drop.ts` endres, med samme `run` og `compare` som over.
- **Ny eksempelskisse:** tegn den i appen, «Lagre fil», legg filen i `src/test/fixtures/` og kjør testene (nye
  snapshots skrives da). Gjør det i en egen PR, ikke sammen med en refaktorering.
