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
   derfor faktureres arrangøren, mens innervegger og romvegger faktureres utstilleren. Ikke bygget ennå.

## Farge på standvegg (ikke bygget)

Der arrangøren dekker standveggene (rundt 90 % av arrangementene), er de nesten alltid hvite. Farge på en standvegg er
da et valg utstilleren betaler selv, men bare for **platebytte**: ny plate i valgt RAL med montering og demontering i
den eksisterende veggen. Rammen, stolpene og løpemeteren vegg er fortsatt arrangørens.

| Vegg | Utstiller betaler | Arrangør betaler |
| --- | --- | --- |
| Standvegg, hvit | Ingenting | Veggen per løpemeter |
| Standvegg, farget | Platebytte (plate i RAL + montering/demontering) | Veggen per løpemeter |
| Innervegg eller romvegg | Veggen per løpemeter i valgt RAL | Ingenting |

I dag regnes alle vegger som utstillerens, med full veggpris i valgt farge. Fakturamottaker per linje og et eget
salgsprodukt for platebytte gjenstår.

## Unntak som ikke er bygget

Med godkjenning fra nabostanden kan en standvegg i praksis endres. Det er sjelden og ikke verdt å modellere nå, så appen
låser standveggene helt.

## Eldre skisser

Skisser fra før låsingen kan ha hull i en standvegg eller en dør i den. Hullene blir stående, men tegnes de igjen, blir
de standvegg. En gammel dør i en standvegg kan fjernes.
