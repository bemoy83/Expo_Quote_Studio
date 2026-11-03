# Kodekart: hvor koden for hvert produkt ligger

Startpunkt for en endring på ett produkt. Oppdateres i hvert trinn av ryddeplanen (november 2026), slik at kartet alltid
stemmer med koden. Begreper: [vegger.md](vegger.md), Foga-reglene: [foga-system.md](foga-system.md), priser:
[prismodell.md](prismodell.md).

## Lagene

Alt avledes fra modellen (`Variant` i `src/domain/types.ts`). Rekkefølgen er alltid den samme:

| Lag | Mappe | Hva |
| --- | --- | --- |
| Modell og redigering | `src/domain/` | Datatypene og rene funksjoner som endrer en variant |
| Regler | `src/rules/rules.ts`, `src/foga/recipes.ts` | Mål, rutenett, oppskrifter og støtteregler |
| Kalkyle | `src/calc/` | L1-linjer, støtte og fotplater, takdragere, produksjon |
| Stykkliste | `src/foga/` | Foga-strukturen og BOM, grunnlaget for plukklisten |
| Pris | `src/pricing/` | Prismodell og tidsbruk |
| Plan | `src/ui/plan/PlanView.tsx` | Tegning og pekerhåndtering for alle produkter |
| 3D | `src/ui/scene3d/build.ts`, `Scene3D.tsx` | Bygging og dra i 3D |
| Skuffer og panel | `src/ui/plan/*Drawer.tsx`, `src/ui/panel/Rail.tsx` | Innstillinger per produkt |
| Sider | `src/ui/quote`, `production`, `picking`, `workorder` | Tilbud, Produksjon, Plukkliste, Arbeidsordre |
| Lagring | `src/persistence/file.ts` | Filformat, versjoner og migrering |

## Per produkt

### Vegger (standvegg, innervegg, romvegg)

- Modell: `Wall` · `domain/walls.ts` (bygde moduler, standvegg, standardtakdrager av/på) · `domain/edit.ts` (tegne,
  viske, flytte, farge) · `domain/panels.ts` (farge per plate) · `domain/grid.ts` (moduler og nøkler)
- Kalkyle: `calc/calc.ts` (vegglinjer, platebytte, arrangørens standvegger) · `foga/fromVariant.ts`
- Plan, 3D, skuff: `PlanView.tsx` · `build.ts` · `WallDrawer.tsx`, `drawerParts.tsx`, `elevation.tsx`

### Takdragere

- Standard: `calc/beams.ts` (`variantBeams` setter sammen alle tre)
- Innvendige (tegnet av kunden): modell `InnerBeam`, redigering `domain/innerBeams.ts`, utlegg `calc/innerBeams.ts`
- Støttedrager på lange standvegger: `calc/supportBeams.ts`
- Hvem betaler: `calc/calc.ts`
- Plan og 3D: `PlanView.tsx` · `build.ts`

### Fotplater (støtteplater)

Tre filer med «support» i navnet, med hver sin jobb:

- `calc/supports.ts`: den felles regelen (minst to fra 1 m, maks 3 m mellom, en ved hver fri ende)
- `calc/wallSupports.ts`: fotplater under systemvegg som står fritt (bruker regelen)
- `calc/supportBeams.ts`: støttedrager, ikke fotplater (hvor en lang standvegg trenger en takdrager)
- Også: `calc/freeFrames.ts` (fotplater under frittstående tekstil), `calc/innerBeams.ts` (under innvendige takdragere)

### Teppefliser

- Modell: `FloorTile` · `domain/floor.ts` (fliser, Auto, kutt, penselhandling)
- Kalkyle: `calc/calc.ts` (gulvseksjon, `tileCounts`)
- Plan, 3D: `PlanView.tsx` · `build.ts`. Ingen skuff, bare panelet (`Rail.tsx`, FloorSection)

### Engangsteppe

- Modell: `FloorTile` med `roll`, `fill`, `split` · `domain/floor.ts` (baner, `rollPieces`, `rollUsage`) ·
  `domain/carpet.ts` (Fyll med forslag, og baneredigering)
- Kalkyle: `calc/calc.ts` (`rollLine`)
- Plan: `PlanView.tsx` (RollPreview, Offcut, LaneMark) · skuff `CarpetDrawer.tsx`
- Kappliste: `ui/cutList.ts`, brukt av skuffen og `WorkOrderPage.tsx`

### Tekstilvegger (43TX)

- InFrame på systemvegg: modell `TextileWall` · `domain/decor.ts` (deles med folie)
- Frittstående: modell `FreeTextile` · `domain/freeTextile.ts`
- Penselen for begge: `domain/textileBrush.ts`
- Kalkyle: `calc/fabric.ts` (InFrame), `calc/freeFrames.ts` (frittstående), `calc/production.ts`, `calc/calc.ts`
- Plan, 3D: `PlanView.tsx` · `build.ts`, `Scene3D.tsx`
- Skuff: `WallDrawer.tsx` (InFrame), `FreeTextileDrawer.tsx` (frittstående)

### Print, dekal og farge

- Dekal: `Foil` · `domain/decor.ts`
- Print med spann og kost: `domain/print.ts`
- Farge per plate: `domain/panels.ts`
- Kalkyle: `calc/calc.ts` (folie, print, platebytte) · `calc/production.ts` (`foilRows`)
- 3D: `build.ts` (teksturbuffer for motiver) · motiver `ui/motifs.ts` · dra inn: `ui/dnd.ts`

### Rom

- Modell: `Room` · `domain/rooms.ts` · `domain/outline.ts` (L-, U-, T-form) · `domain/enclosures.ts` (frihåndsrom)
- Kalkyle: ingen egen, rommet gir vegger
- Plan, 3D: `PlanView.tsx` (RoomMark, håndtak) · `build.ts`, `Scene3D.tsx` · `RoomLabel.tsx`

### Dører og forheng

- Modell: `Opening` · `domain/doors.ts` og `domain/edit.ts` (setOpening, drawOpening, swing) · `domain/rooms.ts`
  (dører som følger rommet)
- Kalkyle: `calc/calc.ts`
- Plan, skuff: `PlanView.tsx` (OpeningMark) · `WallDrawer.tsx`, `DoorMap.tsx`, `DoorSettings.tsx`

### Møbler og utstyr

- Møbler: `PlacedObject` · `domain/objects.ts` · tellevarer: `setCounted` i `domain/edit.ts`
- Kalkyle: `calc/calc.ts` (siste seksjon)

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
