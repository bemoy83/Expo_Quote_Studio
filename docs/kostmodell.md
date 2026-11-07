# Kostmodell: hva ting koster oss

Bestemt 7.11.2026: **kostmotoren bygges i appen**, fra bunnen av. OMS har bare standardiserte stk-priser, som appen
henter. Alt som prosjekteres og bygges (vegger, takdragere, tekstil, senere disker og podier) får kost fra denne
motoren. Bjørns tekstilvegg-kalkulator er gått gjennom og stresstestet, men føres ikke videre; reglene plukkes inn
etter hvert når de er gode. Bakgrunn og stresstest: dokumentet «Tekstilvegg-kalkulatoren: hva den regner, og hva
appen kan hente».

Koden: `src/cost/` (`model.ts` reglene, `params.ts` tallene, `prices.ts` og `example-list.ts` leverandørens prisliste,
`basis.ts` kostgrunnlaget som fil),
tester i `src/cost/*.test.ts`. Motoren kobles til kalkylen produkt for produkt: systemvegg og takdrager først
(trinn 3, under).

## Kostgrunnlaget

Alt motoren regner med, prislister, parametere og ordrekost, er data i én fil: kostgrunnlaget (`src/cost/basis.ts`),
med egen versjon og dato (Bjørn 7.11.2026). Appen har et eksempelgrunnlag med oppdiktede priser. Det ekte lastes inn
på Produktliste-siden og lagres bare i nettleseren, så innprisene aldri publiseres; senere hentes det fra OMS. Det
filen ikke har, hentes fra eksempelet, og kortet på Produktliste sier hva. Lagrer man tilbudet, husker filen hvilket
kostgrunnlag det ble regnet med, og åpnes det med et annet, sier appen fra. Nye tall for kalibrering er en ny fil med
ny versjon, uten ny kode.

```json
{
  "format": "kostgrunnlag", "versjon": 1,
  "kostversjon": "2026-11 A", "dato": "2026-11-07", "kilde": "Bjørn",
  "parametere": { "indirect": 0.1, "owned": { "interest": 0.05 } },
  "ordrekost": [{ "id": "startkost-trykk", "name": "Startkost trykk", "cost": 500, "baseYear": 2022 }],
  "prislister": [{ "supplier": "Foga", "name": "Prislista A", "date": "2022-06", "currency": "SEK",
                   "items": [{ "artnr": "873 805 22", "name": "43TX", "group": "Fabric", "pack": 50, "unit": "m",
                               "price": 0, "broken": 0 }] }]
}
```

`parametere` har samme navn som `CostParams` i `params.ts`; «Last ned mal» gir hele eksempelet som utgangspunkt.

## Innkjøp

Prislisten lagres slik leverandøren trykker den: valuta, pakke, pris ved hel og brutt pakke, og dato. Foga Prislista A
juni 2022 (SEK) er innkjøpsprisene våre og **publiseres ikke** (Bjørn 7.11.2026): repoet og nettsiden er åpne. I appen
ligger en eksempelliste med oppdiktede priser for delene appen bygger med (`src/cost/example-list.ts`), med Fogas
ekte art.nr. Den ekte listen lastes inn som kostgrunnlag (under), senere fra OMS. Av appens 47 Foga-deler finnes alle unntatt 92LL i Fogas liste, og
krok har ikke art.nr. ennå.

`innkjøp i år = listepris × kurs × materialindeks fra listens dato × (1 + frakt)`

Kost regnes uten moms. Kommer en ny prisliste, legges den i et nytt kostgrunnlag, og indeksen starter fra listens dato.

## Direkte og indirekte kost

Kost i motoren er **direkte kost**: det en jobb bruker av utstyr, materiale og arbeid (Bjørn 7.11.2026). Indirekte kost
(administrasjon, lokaler, lager, biler, ledelse) er ett påslag i prosent av direkte kost, i `params.ts` (`indirect`,
eksempel 10 %). Den vises som egen linje i kalkylen og ligger aldri inne i reglene under, så den telles bare én gang.
DG regnes på direkte kost, og kalkylen viser hva som er igjen etter indirekte kost:

`DB = pris − direkte kost`, `DG = DB / pris`, `igjen etter indirekte kost = DB − direkte kost × påslag`

## Seks slags direkte kost

| # | Gjelder | Regel |
| --- | --- | --- |
| 1 | Eid og leid ut: profiler i standardlengde, koblinger, føtter, stolper, LED | (innkjøp / levetid + innkjøp / 2 × rente) / bruk per år + innkjøp × tap per jobb |
| 2 | Spesialkapp: profil kappet utenfor sortimentet (byggeregel X9) | innkjøp per m × lengde × (1 + svinn) × (1 − gjenbruk) + kappetid |
| 3 | Kjøpt til jobben: trykt tekstil, folie, teip | innkjøp × (1 + svinn) |
| 4 | Arbeid: plukk, vask, transport, forhåndsmontering, montering, demontering | personminutter / 60 × timekost × (1 + andel overtid × overtidstillegg × lønnsandel) |
| 5 | Per ordre: startkost trykk, administrasjon, transport | fast, én gang per tilbud |
| 6 | Høyde: over 3,0 m, der 5-trinns stige ikke rekker | lift per dag som egen kost, og monteringsminutter × faktor |

`timekost = timelønn med sosiale kostnader × lønnsindeks fra basisåret / fakturerbar andel`

Personminutter: to montører i 3 minutter er 6 personminutter. Bemanningen er synlig, uten skjulte faktorer.

Eid utstyr: slitasjen er levetiden, med levetid og bruk per år per artikkelgruppe (profiler, plater, koblinger, føtter,
tilbehør). Renten regnes på snittet av det som er bundet, halve innkjøpet, fordi verdien går mot null over levetiden.
Svinn er bare det som går tapt eller ødelegges på én jobb. Lager er indirekte kost.

Overtidstillegget betales på lønnen, ikke på sosiale kostnader, så det ganges med lønnsandelen av timekosten.
Lønnsindeksen er egen, fordi lønn følger tariff og ikke materialpriser.

## Pris

`veiledende pris = direkte kost / (1 − DG-mål)`, med DG-mål per gruppe (se [prismodell.md](prismodell.md)). Kost og pris følger
samme indeks, så DG holder når selgeren gir rabatt (Bjørn 7.11.2026). Påslag gjøres om til DG med
`DG = påslag / (1 + påslag)`: 300 % er 75 %, 30 % er 23 %.

## Prisartikler fra motoren

Pris på tilbudet (Bjørn 7.11.2026): alt i katalogen selges til fast stk-pris fra OMS. For dem gir motoren bare kost,
DG og estimert tid i kalkylen. Motoren setter pris bare på det katalogen ikke dekker, tilpassede størrelser fra
tegningen (sum-produkter, se [prismodell.md](prismodell.md)).

Kalkylen bygger linjene av prisartikler (`src/pricing/data.ts`). En prisartikkel med oppskrift får kost og pris fra
motoren (`src/cost/items.ts`): oppskriften sier hvilke Foga-deler (i listens enhet, meter eller stk) og egne innkjøp
artikkelen består av, og artikkelens egne minutter per håndteringssteg er personminuttene.

`direkte kost = sum av deler × kost per bruk + personminutter / 60 × timekost`, `pris = direkte kost / (1 − DG-mål)`

Kosten regnes for året i kostgrunnlagets dato, så samme kostgrunnlag gir samme priser; nytt år er ny versjon. Mangler
kostgrunnlaget pris på en del, beholder artikkelen eksempeltallene.

Med oppskrift i dag (trinn 3): stolpe 94 med fot, topp- og bunnskinne, HDF-plate og overstykke, dør, forheng,
takdrager i alle lengder, fotplate 750 med 795, krok og skjøt over tekstilvegg (utleie), og montering per modul,
støtteplate, platebytte, takdrager per meter og takdragerstolpe (arbeid). Plater, dører, forheng og krok er egne
innkjøp utenfor Foga, i en egen eksempelliste (`src/cost/own-list.ts`).

Tekstilvegg (trinn 5) prises helt av motoren, også der katalogen har fastpris: som salgsverktøy skal standen kunne
tilpasses kundens ønske uten regler for å kombinere katalogprodukter (Bjørn 7.11.2026). Katalogens fastpriser blir
målet motoren kalibreres mot, innenfor en toleranse. Rammedelene er utleie: 43TX og 92LTX per meter, 617, 609, 604,
520 med 503, stag 90 per meter og per stk med 2 × 600, fotplate 740 og 730. Arbeidet er håndtering per ramme, montering
per kobling (617 og begge ender av hvert stag) og montering av duk per meter omkrets. Duken kjøpes til jobben, med svinn
(type 3): trykk på Blackback som standard, hvit duk, og kundens egen duk bare montert. Tidene for tekstil er ikke
kalibrert ennå.

## Tallene

Alle i `src/cost/params.ts`. Bjørn = bekreftet, forslag = startverdi til OMS har historikk, eksempel = Bjørn ba om
eksempeltall til ekte tall finnes (7.11.2026). Motoren skal kunne få nye tall for kalibrering uten ny kode (trinn 2).

| Tall | Verdi | Kilde |
| --- | --- | --- |
| Levetid, eid utstyr | 2 år | Bjørn |
| Bruk per år: profiler og plater / koblinger, føtter og tilbehør | 7 / 12,5, altså 14 og 25 bruk i levetiden | kalibrert 7.11.2026 |
| Rente på snittet av bundet kapital | 5 % per år | forslag |
| Tap per jobb | 1 % av innkjøp | forslag |
| Indirekte kost | 10 % av direkte kost | eksempel |
| DG-mål: utleie / arbeid / salg | 75 % / 56 % / 23 %, påslagene 300 % / 125 % / 30 % i Bjørns kalkulator | eksempel |
| Timelønn med sosiale kostnader | 391,40 kr, 2022 | Bjørn |
| Fakturerbar andel | 100 % | forslag |
| Overtidstillegg | 100 % | Bjørn |
| Lønnsandel av timekosten | 80 % | forslag |
| Materialindeks | +10 % 2023, +6,7 % 2024, +6 % 2025 og 2026, så +5 % | Bjørns kalkulator |
| Lønnsindeks | samme tall som materialindeksen til ekte tall finnes | eksempel |
| Kurs SEK | 1,00 | plassholder, ikke ekte kurs |
| Frakt | 0 | Bjørn: kanskje 1 700 kr per bestilling, må sjekkes |
| Spesialkapp: gjenbruk / svinn / kappetid | 25 % / 10 % / 5 personminutter | forslag |
| Kjøpt til jobben: svinn | 5 % | forslag |
| Høyde: grense / faktor / lift per dag | 3 000 mm / 1,25 / ikke kjent | Bjørn / forslag / ikke kjent |
| Startkost trykk | 500 kr, 2022, per tilbud | Bjørn |
| Administrasjon, transport | 20 personminutter hver, per tilbud | Bjørns kalkulator |

Eksempel med eksempelprisen 150 kr per m profil, byttet hvert andre år og ute 7 ganger i året: 1 m koster
(150 / 2 + 75 × 0,05) / 7 + 150 × 0,01 = 12,75 kr per bruk.

## Kalibrering

7.11.2026 mot tre stander Bjørn har priset, der utstilleren betaler vegger og takdragere. Prisen er det som selges i
dag, og timene er persontimer for hele varereisen, montering og demontering inkludert:

| Stand | Vegg / takdrager | Pris | Timer |
| --- | --- | --- | --- |
| Hjørne 4 × 3 | 7 / 7 m | 6 202 | 1,84 |
| Rekke 5 × 3 | 11 / 5 m | 9 020 | 2,69 |
| Hjørne 7 × 4 | 11 / 15 m | 10 230 | 3,03 |

Prisene er nøyaktig 765 kr per meter vegg og 121 kr per meter takdrager, uten fast del per stand. Tiden er omtrent 14
minutter per meter vegg og 2 per meter takdrager.

Før kalibreringen ga appen, med ekte Foga-priser, 3,3 ganger prisen og 3,4 ganger tiden. Etter: tidene for vegg- og
takdragerartiklene er skalert (0,34 og 0,15, `TIME_FACTOR` i `src/pricing/data.ts`, fordelingen på stegene beholdt), og
bruk i levetiden er 14 for profiler og plater og 25 for koblinger (var 4 og 10 i Bjørns kalkulator). Da treffer appen
alle tre innen 3 % på tid, og kosten gir DG 70 % på dagens pris (prisen er nå OMS-prisen, 765 kr per meter vegg og
121 per meter takdrager). Tidene sjekkes i `src/calc/calc.test.ts`; prisene sjekkes utenfor repoet,
fordi den ekte prislisten ikke publiseres.

## Åpent

- Når kostgrunnlaget kan hentes fra OMS i stedet for fra fil.
- Riktig kurs SEK–NOK og frakt per bestilling.
- Bruk per år per artikkel, fra OMS når historikken finnes.
- Pris på lift.
- Ekte levetid, bruk per år, påslag for indirekte kost og lønnsindeks.
- Om fortolling fra Sverige gir kost utover frakt (regnskap).
