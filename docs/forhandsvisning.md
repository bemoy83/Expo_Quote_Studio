# Forhåndsvisning: sikte og fantom mens man tegner

Låst av Bjørn 5.11.2026. Bestilling til implementering, oppfølger til [arbeidstegning.md](arbeidstegning.md) (fase 1 og
2 er bygget, #58–#72). Hvor koden ligger: [kodekart.md](kodekart.md).

Designet er prøvd ut i mockupen «Standskisse v6 · forhåndsvisning» i Claude Design. Bildene i
[forhandsvisning/](forhandsvisning/) er fasit. Mockupens kildekode ligger i
[forhandsvisning/referanse/Fantom6.mockup.jsx.txt](forhandsvisning/referanse/Fantom6.mockup.jsx.txt) som oppslag for
verdier. Den er skrevet mot mockupens egen modell og skal **ikke** kopieres inn.

| Bilde | Viser |
| --- | --- |
| [1-sikte.png](forhandsvisning/1-sikte.png) | Pekeren uten trykk, alle ni verktøy: ring eller stiplet omriss i blekk |
| [2-fantom.png](forhandsvisning/2-fantom.png) | Mens man drar eller holder inne: produktets symbol som fantom, mål i pille |
| [3-ugyldig.png](forhandsvisning/3-ugyldig.png) | Ugyldig: grått og skravert, allerede ved peking. Det første eksempelet (vegg oppå standvegg) gjelder ikke i appen, se «Ugyldig» |

## Prinsippet

Forhåndsvisningene deler én grammatikk med tre tilstander. Innholdet er produktets eget symbol fra arbeidstegningen.

| Tilstand | Når | Hvordan |
| --- | --- | --- |
| **Sikte** | Pekeren over tegningen, ingenting trykket | Bare hva som treffes: en ring i festepunktet eller et stiplet omriss i blekk. Likt for alle verktøy, aldri produktfarge |
| **Fantom** | Trykket inne eller mens man drar | Produktets symbol slik det blir tegnet, med redusert styrke, og målet i en mørk pille |
| **Ugyldig** | Både sikte og fantom | Grått og skravert. Grunnen står i hintlinjen (`ui/hints.ts`), ikke på tegningen |

Hvorfor (Bjørn 5.11.2026):

- **Rolig flate.** Man peker mye mer enn man tegner. Bare det som faktisk tegnes får et fantom.
- **Én peker å lære.** Sikte betyr «her treffer du», fantom betyr «dette blir det».
- **Likt på nettbrett.** Uten mus finnes ingen peking, så en fantom ved peking ville vært en funksjon nettbrettet mangler.
- **Trykk viser, slipp lagrer.** Samme regel for verktøy man drar med og verktøy man klikker med.

Vurdert og forkastet:

- Fantom allerede ved peking. Gir mye bevegelse og dobbel informasjon.
- «Fantompeker», et lite merke med produktsymbolet ved pekeren. Verktøyet i hånden vises allerede i verktøylinjen.

## Felles byggesteiner

Legges i `plan/planStyle.ts` og `plan/layers/Previews.tsx`. Alle mål i skjermpiksler via `linePx`/`sizePx`
(`plan/planScale.ts`), ikke i meter.

| Del | Verdi |
| --- | --- |
| Fantomstyrke, vegg og flater | **40 %** (innervegg, tekstil, frittstående tekstil, teppeflis, engangsteppe) |
| Fantomstyrke, tynne streker | **60 %** (takdrager, dør, dekal, møbel) |
| Ring (endepunkt og festepunkt) | radius 3,2 px, fyll `--surface`, blekkant 1,1 px |
| Stiplet omriss (sikte) | blekk 0,8 px, strek 3 px og luft 2,5 px. På mørkt gulv med en lys kant under (`--surface` 80 %, 2,4 px) |
| Festeprikker (`SnapDots`) | blekk 30 %, radius 1,2 px på hele meter og 0,8 px ellers. I dag i meter |
| Ugyldig | blekk 30 % i symbolets bredde med 45°-skravur oppå (blekk 55 %, 0,8 px, 3,2 px mellom). Samme skravur som Tøm |
| Målpille | Mørk pille (`--ink`, tekst `--canvas`, `600 10,5px var(--font-numeric)`, høyde 18 px, radius 5 px), 6 px utenfor streken, på siden **bort fra** standens midtpunkt |

Pillen erstatter `StrokePreview` sin pille, som i dag er tegnet i meter («3 m»). Teksten står i millimeter, som
målene i tegningen:

| Verktøy | Tekst i pillen |
| --- | --- |
| Innervegg | `3 000 · 3 moduler` |
| Takdrager, frittstående tekstil | `3 000` |
| Tekstil på vegg | `2 000 på vegg` |
| Engangsteppe | `3 000 · bane 2 m`, og `· kapp 500` når banen kappes |
| Teppeflis, område | `2 500` og `2 000` på to sider, og `6 fliser · 5 m²` midt i |

Pillen skiller seg bevisst fra målkjedene (`plan/DimChain.tsx`): et mål man drar ut er noe annet enn et ferdig mål.

**Takdragerens fyll** (Bjørn 5.11.2026): ett grått på **20 %** blekk i `BeamStroke` (`plan/layers/BeamLayer.tsx`), i
dag 9 %. Gjelder hele planen, ikke bare fantomet. Bredden er uendret (`beamBody`).

## Per verktøy

Venstre kolonne er det appen gjør i dag (`PlanView.tsx`, «Interaction preview», og `layers/Previews.tsx`).

| Verktøy | I dag | Sikte | Fantom |
| --- | --- | --- | --- |
| Innervegg (`StrokePreview`, `hoverWallEdge`) | Kanten ved pekeren i blekk 45 % i full veggbredde. Ved drag blekk 60 %, svarte prikker, pille i meter | Stiplet omriss av modulen et klikk legger | Veggsymbolet: blekk med kjerne i penselens RAL (`wallWidth`/`wallCore`), et tverrmerke per modul (7 px), ringer i endene, pille |
| Takdrager (samme) | Som over, stiplet | Som innervegg | `BeamStroke` med fyll, ringer, pille |
| Tekstil på vegg (`FacePreview`, `TextilePreview`) | Fyller ledig spenn i lilla 45 % ved peking. Ved drag 70 % og løs tekst | Stiplet omriss langs veggsiden som treffes, i `textileOffset` | `TextileStroke` med tverrstreker, ringer, pille `… på vegg` |
| Frittstående tekstil (`FreePreview`, `hoverFree`) | Prikk i tekstilfarge. Ved drag 60 % og prikker | Ring i festepunktet | `TextileStroke`, fotplatene stiplet (`footStroke`/`footDash`) der kalkylen setter dem, ringer, pille |
| Dekal og motiv (`FacePreview`) | Blekk 45 % langs feltet | Stiplet omriss av feltet, i `printOffset`, på siden som treffes | Rasterbåndet (`RasterPattern`) ved trykk |
| Dør og forheng (`HoverModule`) | Tykk blekkstrek 35 % over modulen | Stiplet omriss på begge sider av modulen | Dørblad og bue (`OpeningMark`) ved trykk |
| Teppeflis (`hoverFloor`) | Flate i produktfarge 75 % med blekkant | Stiplet omriss av penselens størrelse | Ingen: penselen maler mens man drar, så det som tegnes **er** resultatet. Under drag et område: mål og antall som over |
| Engangsteppe, Bane (`RollPreview`) | Banene vises allerede ved peking | Ring i cellen | `RollPreview` bare mens man holder inne (`rollPending`), kappet skravert som i dag, pille |
| Engangsteppe, Fyll (`fillPreview`) | Forslaget for hele standen vises ved peking | Stiplet omriss av standen | Forslaget bare mens man drar eller holder inne |
| Møbel (ingen i dag) | Ingenting før klikket | Stiplet fotavtrykk der møbelet **faktisk** havner (`findSpot` i `domain/objects.ts` flytter det bort fra vegger) | Fotavtrykket i produktets farge med blekkant ved trykk |
| Dra fra hyllen (`dropHover`) | Som `FacePreview` | | Fantom som tekstil eller dekal over |

Tøm (`erase`) er uendret. Den følger allerede samme grammatikk, med dempet og skravert det som skal bort.

### Ugyldig

| Tilfelle | Hvor det sjekkes i dag | Endring |
| --- | --- | --- |
| Dør eller forheng i standvegg | `doorAllowed`, toast **etter** klikket | Skravert modul og hint allerede ved peking |
| Vegg dratt over moduler som finnes | `paintWalls` (`domain/edit.ts`) hopper over dem | Ikke ugyldig. Fantomet viser bare de nye modulene, og pillen teller bare dem. Er ingen nye, hint «Veggen finnes allerede». Mockupen skraverte en innervegg oppå en standvegg, men appen gjør ikke dette til en feil, og det er appen som gjelder |
| Takdrager som ikke kan tegnes (langs en standard takdrager o.l.) | `drawInnerBeam` gir `error`, toast etter slipp (`pointer/stroke.ts`) | Kjør samme sjekk mens man drar. Skravert strek, og feilteksten i hintlinjen |
| Møbel uten plass | `addObject` gir `null`, toast etter klikket | Skravert fotavtrykk og hint ved peking |
| Dekal eller tekstil der det ikke er plass | toast etter klikket | Ingen sikte der, og hint |

Toasten beholdes som reserve når man klikker likevel.

## Trykk viser, slipp lagrer

Dør, dekal og møbel lagrer i dag **ved trykk** (`openingClick`, `decorClick`, `objectClick` kalles fra `press` i
`pointer/usePlanPointer.ts`). De skal få en egen dra-type (forslag `place`, egen fil i `pointer/`):

- **Trykk:** fantomet vises.
- **Slipp:** lagres, hvis pekeren fortsatt treffer det samme (modul, felt eller plass).
- **Drar bort eller trykker Esc:** avbrutt, ingenting lagres.

Vegg, takdrager, tekstil og engangsteppe lagrer allerede ved slipp. Teppeflis maler fortsatt mens man drar.

Endringen er i pekerhåndteringen. Kjør derfor pekerbeviset (`scripts/pointer-replay.mjs`) mot `main`. Den eneste
ventede forskjellen er at dør, dekal og møbel havner i skissen ved slipp i stedet for ved trykk.

## Rekkefølge

Én PR per punkt. Kalkyle- og fil-snapshots skal ikke endres. `scripts/shots.mjs` mot `main` viser de ventede
avvikene.

1. **Byggesteiner:** fantomstyrke, ring, stiplet omriss, skravur for ugyldig, målpillen og `SnapDots` i skjermpiksler. Takdragerfyll 20 %.
2. **Strekverktøyene:** innervegg, takdrager, tekstil på vegg og frittstående tekstil, og dra fra hyllen.
3. **Gulv:** sikte for teppeflis, og Bane og Fyll bare ved trykk.
4. **Trykk viser, slipp lagrer:** dør, dekal og møbel, med ugyldig ved peking. Kjør pekerbeviset.

Når en PR er inne, oppdateres [kodekart.md](kodekart.md).
