# Kodekart: hvor koden for hvert produkt ligger

Startpunkt for en endring på ett produkt. Oppdateres i hvert trinn av ryddeplanen (november 2026), slik at kartet alltid
stemmer med koden. Begreper: [vegger.md](vegger.md), Foga-reglene: [foga-system.md](foga-system.md), priser:
[prismodell.md](prismodell.md).

## Lagene

Alt avledes fra modellen (`Variant` i `src/domain/types.ts`). Rekkefølgen er alltid den samme:

| Lag | Mappe | Hva |
| --- | --- | --- |
| Modell og redigering | `src/domain/` | Datatypene og rene funksjoner som endrer en variant. Id-er: `ids.ts` |
| Regler | `src/rules/rules.ts`, `src/foga/recipes.ts` | Mål, rutenett, oppskrifter og støtteregler |
| Kalkyle | `src/calc/` | `calc.ts` kjører linjeblokkene per produkt (`lines/*`, `textile/lines.ts`) på felles kontekst (`context.ts`); `summary.ts` gir grupper, margin, nøkkeltall og BOM. Typene i `types.ts` |
| Stykkliste | `src/foga/` | Foga-strukturen og BOM, grunnlaget for plukklisten |
| Pris | `src/pricing/` | Prismodell og tidsbruk |
| Plan | `src/ui/plan/PlanView.tsx` | Tegning og pekerhåndtering for alle produkter |
| 3D | `src/ui/scene3d/build.ts`, `build/`, `Scene3D.tsx` | `build.ts` kjører én del per produkt i `build/` på felles kontekst (`build/context.ts`: materialer per lag, farger, `along`); motivteksturer i `build/motifs.ts`. Dra i 3D: `Scene3D.tsx` |
| Skuffer og panel | `src/ui/plan/*Drawer.tsx`, `src/ui/panel/Rail.tsx` | Innstillinger per produkt. Veggskuffen: `WallDrawer.tsx` velger hva som vises, delene ligger i `plan/wallDrawer/` (se Vegger) |
| Sider | `src/ui/quote`, `production`, `picking`, `workorder` | Tilbud, Produksjon, Plukkliste, Arbeidsordre |
| Lagring | `src/persistence/file.ts` | Filformat, versjoner og migrering |

**Ny eller endret linje i kalkylen:** finn produktets blokk i `calc/lines/` (eller `calc/textile/lines.ts`). Det som
er bygget (moduler, stolper, takdragere, fotplater, produksjon) og hvem som betaler, ligger i `calc/context.ts`.
Rekkefølgen på linjene i tilbudet er rekkefølgen blokkene kjøres i `calc/calc.ts`.

## Per produkt

### Vegger (standvegg, innervegg, romvegg)

- Modell: `Wall` · `domain/walls.ts` (bygde moduler, standvegg, standardtakdrager av/på, vegggeometri som
  `defaultSwing`, `doorAllowed`, `isPerimeterWall`) · `domain/edit.ts` (tegne, viske, flytte, farge) · `domain/panels.ts` (farge per plate) · `domain/grid.ts` (moduler og nøkler)
- Kalkyle: `calc/lines/walls.ts` (vegglinjer, arrangørens standvegger) · `calc/lines/swaps.ts` (platebytte) · hvem
  som betaler: `calc/context.ts` · `foga/fromVariant.ts`
- Plan, 3D, skuff: `PlanView.tsx` · `scene3d/build/walls.ts` (plater og dører), `scene3d/build/frame.ts` (stolper, fotplater) · `WallDrawer.tsx`, `drawerParts.tsx`, `elevation.tsx`
- Veggskuffens deler i `plan/wallDrawer/`: `panels.tsx` (panel for farge og print, tekstil, dekal og dør),
  `WallElevation.tsx` (tegningen og slipp fra hyllen), `drag.ts` (dra og endre størrelse på ramme og dekal), `paint.ts`
  (malerspann og malerkost), `face.ts` (sidens navn og rom inntil)

### Takdragere

- Standard: `calc/beams.ts` (`variantBeams` setter sammen alle tre)
- Innvendige (tegnet av kunden): modell `InnerBeam`, redigering `domain/innerBeams.ts`, utlegg `calc/innerBeams.ts`
- Støttedrager på lange standvegger: `calc/supportBeams.ts`
- Linjen og hvem som betaler: `calc/lines/beams.ts` · `calc/context.ts` (`organiserBeams`)
- Plan og 3D: `PlanView.tsx` · `scene3d/build/frame.ts`

### Fotplater (støtteplater)

Tre filer med «support» i navnet, med hver sin jobb:

- `calc/supports.ts`: den felles regelen (minst to fra 1 m, maks 3 m mellom, en ved hver fri ende)
- `calc/wallSupports.ts`: fotplater under systemvegg som står fritt (bruker regelen)
- `calc/supportBeams.ts`: støttedrager, ikke fotplater (hvor en lang standvegg trenger en takdrager)
- Også: `calc/textile/free.ts` (fotplater under frittstående tekstil), `calc/innerBeams.ts` (under innvendige takdragere)
- Linjen: `calc/lines/feet.ts`

### Teppefliser

- Modell: `FloorTile` · `domain/floor/tiles.ts` (fliser og celler) · `domain/floor/brush.ts` (penselen: størrelse,
  Auto, viske) · `domain/floor/edit.ts` (kutte fliser og baner)
- Kalkyle: `calc/lines/floor.ts` (gulvlinjer, `tileCounts`, gulvbeskyttelse)
- Plan, 3D: `PlanView.tsx` · `scene3d/build/floor.ts`. Ingen skuff, bare panelet (`Rail.tsx`, FloorSection)

### Engangsteppe

- Modell: `FloorTile` med `roll`, `fill`, `split` · `domain/floor/lanes.ts` (baner, `rollPieces`, `rollUsage`) ·
  `domain/floor/rollFill.ts` (Fyll med forslag) · `domain/floor/edit.ts` (snu, forlenge og fjerne én bane) ·
  `domain/floor/brush.ts` (penselen for hele baner)
- Kalkyle: `calc/lines/floor.ts` (`rollLine`)
- Plan, 3D: `PlanView.tsx` (RollPreview, Offcut, LaneMark) · `scene3d/build/floor.ts` · skuff `CarpetDrawer.tsx`
- Kappliste: `ui/cutList.ts`, brukt av skuffen og `WorkOrderPage.tsx`

### Tekstilvegger (43TX)

Alt tekstil ligger i to mapper: `domain/textile/` og `calc/textile/`.

- InFrame på systemvegg: modell `TextileWall` · `domain/textile/inFrame.ts` (ledige spenn, legge til, endre, flytte)
- Frittstående: modell `FreeTextile` · `domain/textile/free.ts`
- Penselen for begge: `domain/textile/brush.ts`
- Veggflater og felt (deles med folie): `domain/faces.ts` · tekstil holdes gyldig etter andre endringer i
  `fitDecor` (`domain/decor.ts`)
- Kalkyle: `calc/textile/inFrame.ts` (rammemål og trykk), `calc/textile/free.ts` (frittstående: skinner, hjørner,
  fotplater), `calc/textile/common.ts` (full høyde, filnavn) · linjene: `calc/textile/lines.ts` · produksjonsrader:
  `calc/production.ts` (lager også folierader)
- Plan, 3D: `PlanView.tsx` · `scene3d/build/textile.ts`, `Scene3D.tsx`
- Skuff: `WallDrawer.tsx` med `plan/wallDrawer/panels.tsx` (`TextilePanel`) og `drag.ts` (InFrame), `FreeTextileDrawer.tsx` (frittstående)

### Print, dekal og farge

- Dekal: `Foil` · `domain/decor.ts` (folie og `fitDecor`) · veggflater og felt: `domain/faces.ts`
- Print med spann og kost: `domain/print.ts` · i veggskuffen: `plan/wallDrawer/paint.ts`
- Farge per plate: `domain/panels.ts`
- Kalkyle: `calc/lines/decor.ts` (folie, print-oppsett) · `calc/lines/swaps.ts` (platebytte) · `calc/production.ts` (`foilRows`)
- 3D: `scene3d/build/decor.ts` · teksturbuffer for motiver: `scene3d/build/motifs.ts` · motiver `ui/motifs.ts` · dra inn: `ui/dnd.ts`

### Rom

- Modell: `Room` · `domain/rooms.ts` · `domain/outline.ts` (L-, U-, T-form) · `domain/enclosures.ts` (frihåndsrom)
- Kalkyle: ingen egen, rommet gir vegger
- Plan, 3D: `PlanView.tsx` (RoomMark, håndtak) · `scene3d/build/rooms.ts`, `Scene3D.tsx` · `RoomLabel.tsx`

### Dører og forheng

- Modell: `Opening` · `domain/doors.ts` (sette, tegne, flytte, snu, farge) · hvor en dør kan stå og hvilken vei
  den slår som standard: `domain/walls.ts` · `domain/rooms.ts` (dører som følger rommet)
- Kalkyle: `calc/lines/doors.ts`
- Plan, 3D, skuff: `PlanView.tsx` (OpeningMark) · `scene3d/build/walls.ts` · `WallDrawer.tsx` (`DoorPanel` i `plan/wallDrawer/panels.tsx`), `DoorMap.tsx`, `DoorSettings.tsx`

### Møbler og utstyr

- Møbler: `PlacedObject` · `domain/objects.ts` · tellevarer: `setCounted` i `domain/edit.ts`
- Kalkyle: `calc/lines/objects.ts` (møbler, tellevarer og løse linjer)
- 3D: `scene3d/build/objects.ts`

## Sikkerhetsnett for refaktorering

- **Eksempelskisser:** `src/test/fixtures/*.json`, lagrede skissefiler som dekker alle produktene over.
- **Fasit:** `src/test/fixtures.test.ts` leser skissene med `parse()` og sammenligner kalkyle, tilbudslinjer,
  plukkliste, produksjon og kappliste med lagrede snapshots. Den sjekker også at hver fil lagres tilbake uendret.
  En refaktorering skal ikke endre noen snapshot. Kjør aldri `vitest -u` i en refaktorering: et avvik er en feil til
  det er forklart.
- **Skjermbilder:** `scripts/shots.mjs` tar bilder av plan, 3D, skuffer, Tilbud, Produksjon, Plukkliste og
  Arbeidsordre for hver skisse, og sammenligner to bygg piksel for piksel. Kjøres for hånd på hver refaktorerings-PR:

  ```sh
  git worktree add ../eqs-main origin/main && (cd ../eqs-main && npm ci && npm run build)
  npm run build
  node scripts/shots.mjs shoot ../eqs-main/dist shots/main
  node scripts/shots.mjs shoot dist shots/branch
  node scripts/shots.mjs compare shots/main shots/branch shots/diff
  ```

  Første gang: `npx playwright install chromium`.
- **Ny eksempelskisse:** tegn den i appen, «Lagre fil», legg filen i `src/test/fixtures/` og kjør testene (nye
  snapshots skrives da). Gjør det i en egen PR, ikke sammen med en refaktorering.
