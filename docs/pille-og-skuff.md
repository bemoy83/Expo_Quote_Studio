# Pille og skuff: valgt objekt på tegneflaten

Låst av Bjørn 5.11.2026. Bestilling til implementering. Begreper: [vegger.md](vegger.md), hvor koden ligger:
[kodekart.md](kodekart.md), tegnspråket: [arbeidstegning.md](arbeidstegning.md).

Prøvd ut i mockupen «Standskisse v8 · pille for alt» (og veggverktøyet fra v7) i Claude Design. Bildene i
[pille-og-skuff/](pille-og-skuff/) er fasit for oppførsel og innhold. Mockupens kode ligger i
[pille-og-skuff/referanse/](pille-og-skuff/referanse/) som oppslag. Den er skrevet mot mockupens egen modell og skal
**ikke** kopieres inn.

| Bilde | Viser |
| --- | --- |
| [1-piller.png](pille-og-skuff/1-piller.png) | Pillen for vegg, møbel (rotert), frittstående tekstil og dør |
| [2-skuff.png](pille-og-skuff/2-skuff.png) | Skuffen i detalj og kompakt, med planen som kart over |
| [3-farge-med-verktoy.png](pille-og-skuff/3-farge-med-verktoy.png) | Veggverktøyet farger plater som finnes |

## Formål

Brukeren skal gjøre det meste rett på tegneflaten. **Pillen** gir rask tilgang til enkle grep på det som er valgt.
**Skuffen** er for detaljstyring, og når den åpnes, er veggrisset arbeidsflaten.

## Slik er det i dag

- Et valg i Velg åpner skuffen med en gang (`plan/Drawers.tsx`). Vegg, dør, tekstil og dekal går til `WallDrawer`,
  frittstående tekstil til `FreeTextileDrawer`, og engangsteppe til `CarpetDrawer`.
- Møbel, rom og innvendig takdrager har ingen pille og ingen skuff. Bare markering i planen og Delete
  (`deleteSelection` i `plan/selection.ts`).
- Skuffen er fast 270 px høy (`.wall-drawer.drawer3` i `styles/app.css`).
- Hva et trykk velger, står i `plan/pointer/select.ts`. Valget skjer når man slipper.

## Klikkregler

| Hva man gjør | Hva som skjer |
| --- | --- |
| Klikk på et objekt | Objektet velges og pillen vises med en gang. Skuffen åpnes **ikke** |
| Nytt klikk på samme objekt | Valget fjernes, og pillen lukkes med en gang (Bjørn 6.11.2026). Med skuffen åpen blir valget stående |
| Dobbeltklikk | Er bare to klikk og gjør det samme som ett. Planen har ikke dobbeltklikk (Bjørn 5.11.2026, se under) |
| Klikk på et annet objekt | Valget og pillen bytter |
| Klikk på en vegg med tekstilvegg | Midten av veggen (veggen slik den er tegnet, minst 10 skjermpunkter bred) velger veggen, stripen utenfor hver side velger tekstilen der, bare på tekstilens egen side: bak en standvegg velges veggen (`hits.onWallBand`, `inFrontOf`, Bjørn 6.11.2026) |
| Pek (PC) eller hold (iPad) i Velg | Det et klikk ville valgt får en svak skygge av blekk i sin egen bredde (`layers/PickLayer.tsx`), ikke det som alt er valgt: vegg, tekstil, frittstående tekstil, dør og forheng (feltet), innvendig takdrager, møbel, rom og engangsteppe (banen eller hele fyllet) |
| Klikk på tomt gulv eller utenfor standen | Valget fjernes |
| Dra et valgt objekt | Flytter som i dag. Et drag fjerner aldri valget. Et klikk er et trykk og slipp uten flytting (samme grense som `moved` i dra-typene) |
| Esc | Fjerner valget |

## Pillen

Én komponent (forslag `plan/SelectionPill.tsx`), med samme oppbygning for alt:

`navn og mål` · farge eller motiv · roter (der det gir mening) · **Mer** (åpner skuffen) · fjern

- **Plassering:** over objektet, eller under når det ikke er plass over. Den står aldri over et mål eller over selve
  valget. For vegger står den på motsatt side av modulkjeden (`docs/arbeidstegning.md`, A5: kjeden står mot standens
  midtpunkt, så pillen står bort fra det). Posisjonen regnes fra modellkoordinater til skjermen med samme
  `getScreenCTM` som planen bruker.
- **Skjules** mens man drar, mens skuffen er åpen, og når et annet verktøy enn Velg er i hånden.
- **Bare i planen.** 3D beholder skuffen inntil videre.
- **Stil:** som `QuickPicks` og de flytende linjene ellers. Panelfarge, `--pop`-skygge, radius 10, knapper 30 px,
  skillestreker. Lucide-ikoner.
- **Ingen flytt-knapp.** Dra finnes allerede.

### Innhold per valg

Kolonnen «Finnes» sier hvor funksjonen ligger i dag. **Ny** betyr at den må lages.

| Valg | Navn og mål | Farge eller motiv | Roter | Mer | Fjern | Finnes |
| --- | --- | --- | --- | --- | --- | --- |
| Vegg (innervegg, romvegg) | «Innervegg · 3 m» | Med tekstilvegg på veggen først et valg Vegg · Tekstil mot … per side (`layerSwitch`), som bytter mellom veggen og tekstilene. RAL for hele veggen. «Tekstilvegg» legger til på ledig flate når siden ikke har noen. «Grafikk» åpner motivlisten | – | Veggskuff | ✓ | `setWallPlate` (`domain/edit.ts`), `addTextile`/`fillTextile`, `ColourPanel` |
| Standvegg | «Bak · standvegg · 6 m» | Som over (platebytte) | – | Veggskuff | – (låst) | som over |
| Tekstil på vegg | «Tekstilvegg · 4,00 × 2,50 m» | Valget Vegg · Tekstil mot … som over, motiv, og «Fyll ledig vegg» når den ikke fyller | – | Veggskuff på tekstilen | ✓ | `updateTextile` (`domain/textile/inFrame.ts`), `TextilePanel` |
| Dekal | «Dekal · 1,40 m» | Motiv | – | Veggskuff på dekalen | ✓ | `updateFoil`, `FoilPanel` |
| Frittstående tekstil | «T1 · 2 000 × 2 500» | Motiv på siden som ble klikket (`freeFace`) | **Ny:** 90° om midten | `FreeTextileDrawer` | ✓ | `updateFace` (`domain/textile/free.ts`) |
| Dør, forheng | «Dør med lås · 960» | Dør eller forheng, snu slag, snu hengsel (bare dør), farge på dørbladet | – | Veggskuff med døren | ✓ | `DoorPanel` (`plan/wallDrawer/panels.tsx`) med `flipSwing` og snu hengsel og farge i `domain/doors.ts` |
| Møbel | Produktnavn og mål | Fargevariant (de andre variantene av samme produkt i katalogen) | **Ny:** 90° | – | ✓ | **Ny:** bytt variant. `PlacedObject.rot` finnes |
| Rom | «Bakrom · 2 × 2 m» | – | – | – | ✓ | `removeRoom` |
| Innvendig takdrager | «Takdrager · 3 500» | – | – | – | ✓ | `removeInnerBeam` |
| Engangsteppe | «Bane 2 · 6 000» | Snu (som R) | – | `CarpetDrawer` | ✓ | `rotateLane`, `removeLane`/`removeFill` |

Delete og Backspace fjerner valget som i dag (`deleteSelection`). R roterer valgt møbel eller frittstående tekstil.
R på en bane snur den, som i dag.

### Rotering (ny)

- **Møbel:** `rot` øker med 90 (0, 90, 180, 270). `footprintBox` og 3D (`scene3d/build/objects.ts`) bruker allerede
  `rot`. Etter rotering kjøres samme plassering som etter et drag (`settleObject`). Går det ikke, roteres det ikke, og
  hintet sier hvorfor. Markeringen rundt møbelet skal følge rotasjonen.
- **Frittstående tekstil:** **ny** `rotateFreeTextile(v, rules, id)` i `domain/textile/free.ts`. Den dreier `from`/`to`
  90° om midtpunktet, på tegnerutenettet, og holder veggen innenfor standen. Gyldigheten sjekkes med de samme reglene
  som når veggen tegnes (`addFreeTextile`). Går det ikke, roteres den ikke, og hintet sier hvorfor. Sidene A og B
  følger veggen. Fotplatene regnes på nytt av kalkylen som vanlig.
- Egne enhetstester for begge, ved siden av `freeTextile.test.ts` og `objects`-testene.

### Bytt variant på møbel (ny)

**Ny** `setObjectProduct(v, ctx, id, product)` i `domain/objects.ts`. Den bytter `product` til en annen variant av
samme produkt og beholder plass og `rot`. Er den nye varianten større, kjøres `settleObject`.

## Skuffen

### Når den åpnes

- **Mer** i pillen.
- **Ikke dobbeltklikk** (Bjørn 5.11.2026). Første utgave hadde dobbeltklikk. For at pillen ikke skulle blinke, ventet
  den da 200 ms etter klikket, og et nytt klikk slapp valget først etter 200 ms. I bruk føltes pillen treg, og den
  kom fram selv ved dobbeltklikk. Dobbeltklikk er derfor fjernet. Pillen vises med en gang, og det finnes ingen ventetid i klikkreglene.
  Først beholdt et nytt klikk på det samme valget. 6.11.2026 ville Bjørn ha tilbake at et nytt klikk lukker pillen.
  Uten dobbeltklikk trengs ingen ventetid for det, men et raskt dobbeltklikk blir nå velg og slipp.
- Skuffen åpnes ikke lenger av et vanlig valg. `Drawers.tsx` må styres av en egen tilstand, for eksempel
  `drawer: 'closed' | 'compact' | 'detail'` i `App.tsx`, ikke av `selection` alene.

### To høyder

| Høyde | Verdi | Når |
| --- | --- | --- |
| Kompakt | 270 px (som i dag) | Når man drar kanten ned |
| Detalj | omtrent 60 % av tegneflaten, minst 420 px | **Mer** åpner alltid her |

- **Kanten øverst på skuffen** (14 px) kan dras opp eller ned, eller klikkes for å bytte. Den viser «Detalj» eller
  «Kompakt». Sist brukte høyde kan huskes i `localStorage`, men **Mer** åpner alltid i detalj.
- **Veggrisset fyller skuffen.** Skalaen følger høyden (`elevationBox` / `wd-fit`), så detalj gir omtrent dobbelt så
  stor tegning. Innstillingene står til venstre.
- **To deler** (Bjørn 7.11.2026): innstillinger til venstre og veggrisset til høyre. Grafikkhylla, eller miniplanen når
  en dør er valgt, står under innstillingene og fyller resten av kolonnen. Før var de en egen kolonne i midten, og på
  iPad med begge sidepanelene åpne ble veggrisset bare rundt 160 px bredt. **Kompakt** viser ikke hylla eller
  miniplanen (de får ikke plass i 270 px ved siden av farger, side og knapper). De kommer fram når skuffen dras opp.
- **Planen blir et kart over skuffen,** med valgt vegg markert. Den krymper, og regelen for liten skala (`planScale.ts`,
  `detail: 'compact'`) gir et enklere kart av seg selv.

### Mens skuffen er åpen

- **Pillen er skjult.** Skuffen har alt pillen har.
- **Klikk på en annen vegg i kartet bytter skuffen til den veggen,** i samme høyde. Samme side vises hvis veggen har
  den. Det gjelder også dør, tekstil og dekal, som åpner i veggskuffen.
- **Klikk på et objekt med egen skuff** (frittstående tekstil, engangsteppe) bytter til den skuffen.
- **Klikk på et objekt uten skuff** (møbel, rom, takdrager) lukker skuffen og viser objektets pille.
- **Klikk på tomt gulv** lukker skuffen og fjerner valget.
- **Esc eller lukkeknappen** lukker skuffen og fjerner valget (Bjørn 5.11.2026: ingen vei tilbake til pillen, det ville
  gitt et ekstra klikk hver gang). Esc fra en dør går fortsatt først tilbake til veggen (`doorWall`), som i dag.

## Veggverktøyet farger vegg som finnes

I dag hopper `paintWalls` over moduler som finnes, så et klikk med veggverktøyet på en vegg gjør ingenting.

- Med veggverktøyet i hånden farger et **klikk på en plate som finnes** den platen i pennens RAL (`brush.ral`), med
  `setPanels` (`domain/panels.ts`). **Dra langs veggen** farger flere plater på samme vegg.
- Sikte og fantom følger [forhandsvisning.md](forhandsvisning.md): én stiplet linje over platen ved peking. Ved trykk
  vises veggsymbolet i den nye fargen med 40 % styrke og pillen «3 plater · RAL 5007». Lagres ved slipp, og Esc
  avbryter.
- Er fargen den samme som veggens egen farge, fjernes platens egen farge (`clearPanels`).
- Et klikk på en tom kant tegner ny vegg som før. Et drag som starter på tom kant, tegner også som før.
- Hintlinjen: «Klikk en vegg for å farge den · dra for flere plater · klikk en tom kant for ny vegg».
- Platebytte på standvegg prises som i dag (`calc/lines/swaps.ts`).

## Tester

- **Enhetstester** for `rotateFreeTextile`, rotering av møbel (`rot`, og ingen rotering når det ikke er plass) og
  `setObjectProduct`.
- **Pekerbeviset** (`scripts/pointer-replay.mjs`): `drawer` endrer seg for alle steg der et klikk før åpnet skuffen.
  Det er ventet og forklares i PR-en. Nye steg:
  - klikk, klikk igjen (beholder valget) og klikk utenfor på vegg, møbel og frittstående tekstil
  - Mer: skuffen åpnes i detalj
  - dobbeltklikk på en vegg: velger bare, og pillen vises
  - mens skuffen er åpen: klikk på en annen vegg (bytter), klikk på et møbel (lukker og viser pillen), klikk på tomt
    gulv (lukker)
  - veggverktøyet: klikk på en plate som finnes, og dra over tre plater
- **Kalkyle-snapshots:** uendret, bortsett fra fargelegging med veggverktøyet, som ingen eksempelskisse bruker.

## Rekkefølge

Én PR per punkt. Kjør `scripts/shots.mjs` og pekerbeviset mot `main`.

1. **Valg uten skuff:** klikkreglene, og egen tilstand for skuffen (`drawer`). Skuffen åpnes fra panelet
   inntil pillen finnes (dobbeltklikk var her først, og ble fjernet etter PR 5).
2. **Pillen:** komponent og plassering, innhold for vegg, tekstil, dekal, dør, rom, takdrager og engangsteppe, og
   **Mer**.
3. **Møbel og frittstående tekstil:** pille med variant (`setObjectProduct`) og rotering (`rot`,
   `rotateFreeTextile`), med tester.
4. **Skuffen i to høyder:** kompakt og detalj, kanten, planen som kart, og bytte av objekt mens skuffen er åpen.
5. **Veggverktøyet farger vegg som finnes.**

Når en PR er inne, oppdateres [kodekart.md](kodekart.md).

## Utenfor denne bestillingen

- Pille i 3D.
- Flytt-knapp og dupliser. Dupliser finnes ikke i appen.
- Pille for flere valgte objekter samtidig.
