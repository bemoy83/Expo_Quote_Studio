# Vegger: standvegg, innervegg og romvegg

Låst av Bjørn 31.10.2026. Begrepene brukes likt i appen, koden og samtaler. Byggereglene for veggene (V6, V7, S1–S8,
D3) og hvem som bygger (B1, B2) står nummerert i [byggeregler.md](byggeregler.md).

## Begreper

| Begrep | Hva | I koden |
| --- | --- | --- |
| **Standvegg** | Veggene standtypen gir på de lukkede sidene (rekke, hjørne, ende). De skiller utstillere som deler samme område i hallen og følger det kjøpte arealet. | `isStandWall(w)`: id `side-back`, `side-left` …, biter `side-back-1` |
| **Innervegg** | Vegg kunden velger i tillegg (tilvalg), tegnet hvor som helst på standen, også ut mot standkanten. | Alle lagrede vegger som ikke er standvegg eller romvegg. `canMoveWall(w)` |
| **Romvegg** | Sidene til et rom (bakrom, lager, møterom). Også tilvalg. Der et rom står inntil en standvegg, gjenbrukes standveggen. | `w.room` |

En **frittstående tekstilvegg** er ikke en vegg i denne forstand: den er ikke en del av systemveggen, lager ikke rom og
kan ikke ha dør. Den kan ikke stå langs eller gjennom en systemvegg. Se [foga-system.md](foga-system.md).

En vegg er standvegg fordi den kommer fra standtypen, aldri fordi den står i standkanten. En innervegg som flyttes helt ut
til kanten, er fortsatt en innervegg. `isPerimeterWall` sier bare hvor en vegg står (brukes til dørslag mot gangen), ikke
hva slags vegg det er.

## Egenskaper

| | Standvegg | Innervegg | Romvegg |
| --- | --- | --- | --- |
| Kommer fra | Standtype | Tegnes | Rommet |
| Flytte | Nei | Ja, i hele meter, helt ut til kanten, men ikke inn på en standvegg. Frittstående: i begge retninger. Står den inntil en annen innervegg: bare til siden, så skjøten ikke dras fra hverandre | Via rommet (dra siden eller rommet) |
| Fjerne | Nei | Ja | Siden kan åpnes |
| Dør eller forheng | Nei | Ja | Ja |
| Plate-farge | Ja | Ja | Ja (per rom) |
| Tekstilvegg og folie | Innsiden | Begge sider | Begge sider |
| Endres når standtypen endres | Bygges på nytt | Beholdes hvis den passer, unntatt deler som havner på en ny standvegg | Beholdes innenfor standen |

## Hvorfor skillet er viktig

1. **Kjøpt areal.** Standvegger er knyttet til arealet utstilleren har kjøpt. En senere versjon kan hente standtypen
   fra kunden sitt kjøpte areal, slik at valget av standtype faller bort.
2. **Fakturamottaker.** Messearrangøren baker ofte standveggene inn i prisen for standarealet. Løpemeter standvegg kan
   derfor faktureres arrangøren, mens innervegger og romvegger faktureres utstilleren. Se under.

## Hvem betaler standveggene

Bygget 31.10.2026. Prosjektet (messen) har innstillingen **Standvegger betales av: Arrangør / Utstiller**, standard
Arrangør, og **Arrangørens farge**, standard hvit RAL 9010. Den skal senere komme fra prosjektet i OMS, sammen med kjøpt
areal. Innstillingen står i standbrikken øverst til venstre på tegneflaten (fra 2.11.2026; før i
«Kunde og prosjekt»). Ny arrangørfarge maler om stander som hadde den gamle fargen (`defaultPlate`), så de
ikke får platebytte; en stand i en annen farge er utstillerens valg og blir stående. I koden: `Project.standWalls`,
`standWallTerms` og `setStandWallTerms` (`domain/variant.ts`).

Der arrangøren dekker standveggene (rundt 90 % av arrangementene), er de nesten alltid hvite. Farge på en standvegg er
da et valg utstilleren betaler selv, men bare for **platebytte**: ny plate i valgt RAL med montering og demontering i
den eksisterende veggen. Rammen, stolpene og løpemeteren vegg er fortsatt arrangørens, i arrangørens farge.

| Vegg | Utstiller betaler | Arrangør betaler |
| --- | --- | --- |
| Standvegg i arrangørens farge | Ingenting | Veggen per løpemeter |
| Standvegg i annen farge | 6125-RAL Platebytte standvegg per lm | Veggen per løpemeter i arrangørens farge |
| Innervegg eller romvegg | 6120-RAL veggen per løpemeter | Ingenting |
| Standvegg når utstilleren betaler | 6120-RAL veggen per løpemeter, egen linje «Standvegg» | Ingenting |

Platebytte prises som sum: platen i RAL og ledd for platebytte (ut og inn, montering og demontering, med egen tid).
Art.nr. 6125 er en plassholder.

### Takdrager følger standveggene

Låst av Bjørn 31.10.2026. Samme regel for fakturamottaker gjelder takdragere som følger av standveggene.

- **Standard takdrager** er de appen legger selv langs de åpne sidene i dag. De følger av og støtter standveggene, og
  dermed det kjøpte arealet. Betaler arrangøren standveggene, betaler arrangøren også disse takdragerne, med stolpene
  bare de trenger. De er da ute av tilbudet, plukklisten og arbeidsordren, som standveggene.
- **Åpent areal uten standvegger** (øystand) får som regel ikke takdrager fra arrangøren. Utstilleren betaler dem fullt.
- **Innvendig takdrager** (tilvalg, 1.11.2026) tegnes med egen pensel for kundens egne ønsker utover det veggene gir.
  De er alltid utstillerens, på samme måte som innervegger, og har egen klassifisering (`Variant.innerBeams`). Regler i
  [foga-system.md](foga-system.md).

I koden: `organiserBeams` i `calc/calc.ts` og nøkkeltallet `organiserBeamLm`.

### Støtteplater når takdragerne er valgt bort

Bjørn 1.11.2026. Velger kunden bort takdragerne, står veggene fritt og får støtteplater (se
[foga-system.md](foga-system.md)). Platene er kundens valg og faktureres alltid utstilleren, også under standvegger
arrangøren betaler, og de plukkes og monteres hos utstilleren. Det samme vil gjelde støttevaier når den kommer.

### Hva utstilleren får, og hva arrangøren får

Hver kalkylelinje har en fakturamottaker (`CalcLine.payer`). Standveggene arrangøren betaler er ikke med i noe av det
utstilleren får:

- **Tilbudet** viser bare utstillerens linjer, og én tekst uten pris: «Standvegger 10 lm i hvit og takdrager 10 m leveres av arrangøren».
- **Plukklisten og arbeidsordren** viser bare det utstilleren har bestilt (Bjørn 31.10.2026). Arrangørens vegger kommer
  som en egen bestilling fra OMS for hele hallen. Ellers ville de blitt plukket per stand, og en vegg mellom to stander
  rygg i rygg ville blitt telt to ganger. Platene til platebytte plukkes hos utstilleren.
- **Stolper**: en stolpe som står i arrangørens standvegg er arrangørens, også når en innervegg eller et rom står inntil.
  Utstilleren betaler og plukker bare stolpene i egne vegger.
- **Kalkylen** viser arrangørens linjer i en egen blokk, «Faktureres arrangør», med pris, kost og DG. Den er ikke med i
  standens sum, margin eller tid. Den er et grunnlag per stand; fakturaen til arrangøren lages i OMS.
- **Nøkkeltall**: standvegg, innervegg og romvegg i lm hver for seg (`standWallLm`, `organiserWallLm`, `innerWallLm`,
  `roomWallLm`, `swapLm`), og takdrager fra arrangøren (`organiserBeamLm`).

## Farge per plate

En vegg har én farge (`Wall.plate`, rommets `Room.plate`, ellers standens `defaultPlate`). Enkeltplater kan få sin egen
farge i veggskuffen. Det virker som i et tegneprogram: velg malerspannet (hele veggen) eller malerkosten (én og én plate),
velg farge, og klikk veggen. Med kosten kan du også dra over flere plater. Velger du en farge uten verktøy, tar du opp
malerspannet. Uten verktøy velger og flytter tegningen som før. Fargen
lagres per modul i `Variant.panels` (domain/panels.ts), nøklet på platens kant i planen:

- Én plate er én HDF-plate, så fargen gjelder begge sider. Skal én side ha noe annet, blir det folie på hele platen.
- Der en romside står på en standvegg, er platen standveggens, og fargen også.
- Fargen følger med når en innervegg eller et rom flyttes eller endrer form, og forsvinner når platen fjernes.
- Hel-vegg-farge tar over: platene på veggen får veggens nye farge.
- «Fyll» i veggpillen i planen (malerspann, Bjørn 11.11.2026) gir alle vegger på standen pennens farge: den blir
  standens farge (`defaultPlate`), og egne farger på vegger, rom, enkeltplater og dørblad går av (`paintAllWalls`).
  Siste strøk vinner, så print på hele plater går også; dekaler og tekstilrammer blir stående. Ett angre tar alt tilbake.
- Kalkylen har én linje per farge. En farget plate i en standvegg arrangøren betaler blir platebytte for akkurat den
  platen (6125-RAL). Plukklisten teller plater per RAL, og overstykket over en dør har platens farge.

## Velg et felt

Bjørn 9.11.2026: i veggskuffen velger du først, så handler du. Klikk en plate i veggrisset (uten verktøy) for å velge
feltet, klikk den igjen for hele veggen. Feltet har to sider, byttet med knappen nederst i skuffen slik døren har sin
vei tilbake til paletten (`FeltPanel` i ui/plan/wallDrawer/panels.tsx):

- **Farge og profilering** (først), med samme ord som skinnen og verktøybrikken (Bjørn 9.11.2026). «FELT n · farge»:
  paletten er det som dekker platen. En farge gjelder bare denne platen (begge sider, det er én plate); «Print» sist
  legger hele motivet på platen, på siden som vises. Siste strøk vinner som med kosten. Under ligger seksjonen
  «PROFILERING» med motivbiblioteket: et trykk på et motiv printer platen med en gang, slik et trykk på en farge farger
  den (Bjørn 11.11.2026); samme motiv igjen gjør ingenting, og et felt som ikke kan ha print sier hvorfor. Motivet blir
  også det Print og Dekal bruker. «+ Dekal» legger en dekal midt i feltet (ikke på et printet felt) og velger den, så
  bytter et motiv dekalens motiv. Med hele veggen valgt har
  Profilering «+ Tekstilvegg» og motivene som dras til veggen.
- **Hyller og heng**: tilbehør som festes i feltet, én seksjon per slag (hyller nå, heng senere). «Hylle til i feltet»
  legger til og velger hyllen. En valgt hylle har «Farge og profilering» nederst tilbake til feltet; fjernes hyllen, står
  du på feltets hyller igjen. Tilbehørssiden er bygget for å skalere: nye slag får en egen seksjon der.
- Hele veggen har de samme to sidene (Bjørn 9.11.2026). «Hyller og heng» med hele veggen valgt fyller veggen med
  automatisk plassering, slik «Hylle til» gjør i et felt. «+ Hylle» går felt for felt, rad for rad: neste hylle i raden
  som fylles (1300, så samme rekkefølge som i et felt, Byggeregel H4), i feltet nærmest midten som har plass (`addShelfToFace`).
  «+ Hyllerad» legger én hylle i hvert felt som kan ta hylle, i samme høyde: 1300, så samme rekkefølge som i
  et felt (H4); den første høyden alle feltene har plass i, ellers den flest har plass i (`addShelfRowToFace`, H2, H5, H6).
- Å legge til hyller velger ingenting (Bjørn 9.11.2026): du kan trykke videre uten avbrudd, og så trykke en hylle eller
  rad i veggrisset for å endre den. Gjelder også «Hylle til i feltet».
- Hyllepensel (Bjørn 9.11.2026): penselknappen i hylleseksjonen på «Hyller og heng» legger hyller rett i veggrisset,
  i feltet og på høyden pekeren står på. Musen over et felt viser dempet den hyllen et klikk legger, med høyden i en
  mørk pille og i målkjeden; trykk og dra sideveis gir en rad på én høyde, opp og ned flytter høyden før du slipper.
  Høyden fester seg først til en hylle i nabofeltet innen 60 mm (raden holder sammen, H2), så til de faste høydene
  innen 40 mm, ellers nærmeste 50 mm (H4). Felt som ikke kan ta hylla (under 100 mm lysmål,
  dør, tekstil, hjørne) skraveres med grunnen i hintlinjen, og klikket gjør ingenting der. Et felt med hyller fra
  før får en hylle til i stabelen. Står pekeren på en hylle som er der, skraveres den som i Tøm, og klikket tar den
  av igjen, slik malerkosten tar av en farge (Bjørn 9.11.2026): en hylle for mye fjernes uten å legge bort pensla.
  Bare den ene hyllen går, ikke raden, og et dra som starter på en hylle fjerner bare den. Pensla velger ingenting og blir liggende; Esc, et nytt trykk
  på knappen eller «Farge og profilering» legger den bort. På iPad (ingen hover) vises hylla fra du trykker.
- Shift på hyllepensla (Bjørn 9.11.2026) gir antall og fordeling i stedet for høyde: Shift-klikk i et felt er «Hylle
  til i feltet» (tomt felt: nabohøyden eller 1300, ellers neste faste høyde over den øverste, så under, så 100 mm; først da deles hullene på midten). Shift-dra opp
  legger til én hylle til per ca. 40 skjermpiksler etter samme regel, ned tar dem bort igjen, men aldri under én og
  aldri hyller som sto der før. Shift-dra sideveis kopierer feltets hyller til feltene du drar over, som «Kopier
  feltet»; et felt beholder en hylle det alt har på en av høydene, og et felt med hyller for nær får ingen og
  skraveres. Shift finnes ikke på iPad; der gjelder knappene i skuffen.
- ← → bytter felt og beholder siden. Dører er ikke felt: klikk på en dør velger døren.
- Malerspann og malerkost ligger også på fargesiden. Velger du ett av dem, slipper feltet, og du farger hele veggen eller
  plate for plate som før, uten å gå ut av skuffen.
- Søppelbøtta med et felt valgt tar bare feltets egen farge og printen på denne siden (`clearFelt` i domain/print.ts).
  Dekaler og hyller fjernes én og én.
- Ikke bygget (parkert): velge flere felt samtidig, og velge felt ved klikk i planen eller 3D.

## Print på hele plater

Siste valg i paletten er «Print». Det legger motivet som er valgt i grafikkhyllen på hele plater som folie (8021), på den
siden skuffen viser (domain/print.ts):

- Malerspannet strekker ett motiv over alle platene på siden som kan ha print, men ikke inne i et bakrom som står inn
  mot siden (kosten kan fortsatt legge print der). Motivet dekker hele flaten og sentreres
  (beskjæres, strekkes aldri), og kuttes per plate. Bildet går videre bak stolpene, så skjøtene ligger på linje.
  Hver plate husker sin del av bildet (`Foil.crop`), og platene i samme motiv deler `Foil.run`.
- Malerkosten legger hele motivet på én plate, som «Hel plate» i dag.
- Klikker du igjen med samme motiv, forsvinner det (spannet: hele siden, kosten: platen).
- Print erstatter dekalene på platen. En farge malt på siden tar bort printen der, men dekalene blir (Bjørn 2.11.2026).
  Fargen gjelder fortsatt begge sider, så den andre siden beholder sin print.
- Siste strøk vinner (Bjørn 3.11.2026). Print over en farge tar fargen bort der den ikke lenger synes: en plate der alle
  sidene som kan ha dekor er printet (standvegg: innsiden, innervegg og romvegg: begge sider) mister sin egen farge, og
  er hele veggen (rommet) dekket, går veggens farge også. Platen får standens farge igjen. En innervegg printet på én
  side beholder fargen, for den synes på den andre. Angre tar fargen tilbake; ingen dialog.
- Platebytte (6125) regnes ikke for en standveggplate som er printet: det er arrangørens plate med print på, også når
  standens farge er en annen enn arrangørens. Slik betales platen aldri både som farge og som print.
- Platene bak en tekstilramme hoppes over, det samme gjør forheng og plater som tilhører en annen vegg. En dør får
  trykk på overstykket og dørbladet (dørbladet tegnes enkelt til vi har en nøyaktig beskrivelse av det).
- Med hele veggen valgt tømmer søppelbøtta øverst i skuffen veggen for dekor: all folie (print og dekaler) på begge
  sider går, og platene får veggens farge igjen. Tekstilrammer blir stående. På en vegg uten dekor fjerner bøtta veggen
  som før (romvegg: åpner siden).
- Pris: 8021 per plate. Et motiv strukket over flere plater gir i tillegg én linje 8022 «Tilpasning av trykkfil over
  flere plater» per motiv. Trykklisten i arbeidsordren har én fil per plate, med «2 av 6» for strukne motiv.

## Unntak som ikke er bygget

Med godkjenning fra nabostanden kan en standvegg i praksis endres. Det er sjelden og ikke verdt å modellere nå, så appen
låser standveggene helt.

## Eldre skisser

Skisser fra før låsingen kan ha hull i en standvegg eller en dør i den. Hullene blir stående, men tegnes de igjen, blir
de standvegg. En gammel dør i en standvegg kan fjernes.
