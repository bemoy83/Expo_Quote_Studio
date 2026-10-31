# Vegger: standvegg, innervegg og romvegg

Låst av Bjørn 31.10.2026. Begrepene brukes likt i appen, koden og samtaler.

## Begreper

| Begrep | Hva | I koden |
| --- | --- | --- |
| **Standvegg** | Veggene standtypen gir på de lukkede sidene (rekke, hjørne, ende). De skiller utstillere som deler samme område i hallen og følger det kjøpte arealet. | `isStandWall(w)`: id `side-back`, `side-left` …, biter `side-back-1` |
| **Innervegg** | Vegg kunden velger i tillegg (tilvalg), tegnet hvor som helst på standen, også ut mot standkanten. | Alle lagrede vegger som ikke er standvegg eller romvegg. `canMoveWall(w)` |
| **Romvegg** | Sidene til et rom (bakrom, lager, møterom). Også tilvalg. Der et rom står inntil en standvegg, gjenbrukes standveggen. | `w.room` |

En vegg er standvegg fordi den kommer fra standtypen, aldri fordi den står i standkanten. En innervegg som flyttes helt ut
til kanten, er fortsatt en innervegg. `isPerimeterWall` sier bare hvor en vegg står (brukes til dørslag mot gangen), ikke
hva slags vegg det er.

## Egenskaper

| | Standvegg | Innervegg | Romvegg |
| --- | --- | --- | --- |
| Kommer fra | Standtype | Tegnes | Rommet |
| Flytte | Nei | Ja, i hele meter, helt ut til kanten, men ikke inn på en standvegg | Via rommet (dra siden eller rommet) |
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
areal. I koden: `Project.standWalls` og `standWallTerms` (`domain/variant.ts`).

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

### Hva utstilleren får, og hva arrangøren får

Hver kalkylelinje har en fakturamottaker (`CalcLine.payer`). Standveggene arrangøren betaler er ikke med i noe av det
utstilleren får:

- **Tilbudet** viser bare utstillerens linjer, og én tekst uten pris: «Standvegger 10 lm i hvit leveres av arrangøren».
- **Plukklisten og arbeidsordren** viser bare det utstilleren har bestilt (Bjørn 31.10.2026). Arrangørens vegger kommer
  som en egen bestilling fra OMS for hele hallen. Ellers ville de blitt plukket per stand, og en vegg mellom to stander
  rygg i rygg ville blitt telt to ganger. Platene til platebytte plukkes hos utstilleren.
- **Stolper**: en stolpe som står i arrangørens standvegg er arrangørens, også når en innervegg eller et rom står inntil.
  Utstilleren betaler og plukker bare stolpene i egne vegger.
- **Kalkylen** viser arrangørens linjer i en egen blokk, «Faktureres arrangør», med pris, kost og DG. Den er ikke med i
  standens sum, margin eller tid. Den er et grunnlag per stand; fakturaen til arrangøren lages i OMS.
- **Nøkkeltall**: standvegg, innervegg og romvegg i lm hver for seg (`standWallLm`, `organiserWallLm`, `innerWallLm`,
  `roomWallLm`, `swapLm`).

## Unntak som ikke er bygget

Med godkjenning fra nabostanden kan en standvegg i praksis endres. Det er sjelden og ikke verdt å modellere nå, så appen
låser standveggene helt.

## Eldre skisser

Skisser fra før låsingen kan ha hull i en standvegg eller en dør i den. Hullene blir stående, men tegnes de igjen, blir
de standvegg. En gammel dør i en standvegg kan fjernes.
