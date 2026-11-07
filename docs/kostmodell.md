# Kostmodell: hva ting koster oss

Bestemt 7.11.2026: **kostmotoren bygges i appen**, fra bunnen av. OMS har bare standardiserte stk-priser, som appen
henter. Alt som prosjekteres og bygges (vegger, takdragere, tekstil, senere disker og podier) får kost fra denne
motoren. Bjørns tekstilvegg-kalkulator er gått gjennom og stresstestet, men føres ikke videre; reglene plukkes inn
etter hvert når de er gode. Bakgrunn og stresstest: dokumentet «Tekstilvegg-kalkulatoren: hva den regner, og hva
appen kan hente».

Koden: `src/cost/` (`model.ts` reglene, `params.ts` tallene, `prices.ts` og `example-list.ts` leverandørens prisliste),
tester i `src/cost/model.test.ts`. Motoren er ikke koblet til kalkylen ennå; det skjer produkt for produkt.

## Innkjøp

Prislisten lagres slik leverandøren trykker den: valuta, pakke, pris ved hel og brutt pakke, og dato. Foga Prislista A
juni 2022 (SEK) er innkjøpsprisene våre og **publiseres ikke** (Bjørn 7.11.2026): repoet og nettsiden er åpne. I appen
ligger en eksempelliste med oppdiktede priser for delene appen bygger med (`src/cost/example-list.ts`), med Fogas
ekte art.nr. Den ekte listen skal komme fra OMS. Av appens 47 Foga-deler finnes alle unntatt 92LL i Fogas liste, og
krok har ikke art.nr. ennå.

`innkjøp i år = listepris × kurs × materialindeks fra listens dato × (1 + frakt)`

Kost regnes uten moms. Kommer en ny prisliste, legges den inn som egen fil, og indeksen starter fra dens dato.

## Seks slags kost

| # | Gjelder | Regel |
| --- | --- | --- |
| 1 | Eid og leid ut: profiler i standardlengde, koblinger, føtter, stolper, LED | (innkjøp / levetid + innkjøp × (rente + skade og svinn) + lager per år) / bruk per år |
| 2 | Spesialkapp: profil kappet utenfor sortimentet (byggeregel X9) | innkjøp per m × lengde × (1 + svinn) × (1 − gjenbruk) + kappetid |
| 3 | Kjøpt til jobben: trykt tekstil, folie, teip | innkjøp × (1 + svinn) |
| 4 | Arbeid: plukk, vask, transport, forhåndsmontering, montering, demontering | personminutter / 60 × timekost × (1 + andel overtid × overtidstillegg) |
| 5 | Per ordre: startkost trykk, administrasjon, transport | fast, én gang per tilbud |
| 6 | Høyde: over 3,0 m, der 5-trinns stige ikke rekker | lift per dag som egen kost, og monteringsminutter × faktor |

`timekost = timelønn med sosiale kostnader × lønnsindeks fra basisåret / fakturerbar andel`

Personminutter: to montører i 3 minutter er 6 personminutter. Bemanningen er synlig, uten skjulte faktorer.

Felleskostnader (lokaler, biler, ledelse) legges inn én gang, i timekosten eller i lagerkosten, aldri som påslag i
tillegg.

## Pris

`veiledende pris = kost / (1 − DG-mål)`, med DG-mål per gruppe (se [prismodell.md](prismodell.md)). Kost og pris følger
samme indeks, så DG holder når selgeren gir rabatt (Bjørn 7.11.2026). Påslag gjøres om til DG med
`DG = påslag / (1 + påslag)`: 300 % er 75 %, 30 % er 23 %.

## Tallene

Alle i `src/cost/params.ts`. Bjørn = bekreftet, forslag = startverdi til OMS har historikk.

| Tall | Verdi | Kilde |
| --- | --- | --- |
| Levetid, eid utstyr | 2 år | Bjørn |
| Bruk per år | 10 | forslag |
| Rente / skade og svinn | 5 % / 5 % per år | forslag |
| Lager per enhet og år | 0 kr | ikke kjent |
| Timelønn med sosiale kostnader | 391,40 kr, 2022 | Bjørn |
| Fakturerbar andel | 100 % | forslag |
| Overtidstillegg | 100 % | Bjørn |
| Materialindeks og lønnsindeks | +10 % 2023, +6,7 % 2024, +6 % 2025 og 2026, så +5 % | Bjørns kalkulator |
| Kurs SEK | 1,00 | plassholder, ikke ekte kurs |
| Frakt | 0 | Bjørn: kanskje 1 700 kr per bestilling, må sjekkes |
| Spesialkapp: gjenbruk / svinn / kappetid | 25 % / 10 % / 5 personminutter | forslag |
| Kjøpt til jobben: svinn | 5 % | forslag |
| Høyde: grense / faktor / lift per dag | 3 000 mm / 1,25 / ikke kjent | Bjørn / forslag / ikke kjent |
| Startkost trykk | 500 kr, 2022, per tilbud | Bjørn |
| Administrasjon, transport | 20 personminutter hver, per tilbud | Bjørns kalkulator |

Eksempel med eksempelprisen 150 kr per m: eid, byttet hvert andre år og ute 10 ganger i året, koster 1 m
(150 / 2 + 150 × 0,10) / 10 = 9 kr per bruk.

## Åpent

- Hvordan den ekte prislisten kommer inn uten å publiseres (fra OMS).
- Riktig kurs SEK–NOK og frakt per bestilling.
- Bruk per år per artikkel, fra OMS når historikken finnes.
- Lagerkost og pris på lift.
- Om fortolling fra Sverige gir kost utover frakt (regnskap).
