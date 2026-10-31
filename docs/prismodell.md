# Prismodell: kravspec for nytt OMS

Bjørns arbeidsplass skal bygge et nytt OMS fra bunnen av (31.10.2026). Dette dokumentet beskriver prismodellen vi
ønsker, slik at den kan brukes som kravspec. Expo Quote Studio er referansen for hva appen trenger fra OMS, og
`src/pricing/` viser appens side av modellen i kode.

**Ansvarsdeling.** OMS eier produktene, grupperingen og hele kostmodellen, og regner ut ferdige tall. Appen regner
ikke ut kostpris eller påslag. Den får kost og pris per enhet fra OMS og gjør bare én ting selv: for et produkt som
prises som sum av artikler legger den sammen de ferdige artikkelprisene for det som faktisk er tegnet.

Alle tall i appen i dag er eksempeltall (`src/pricing/data.ts`, og kost i `src/catalog/defaultCatalog.ts`).

## 1. Tre nivåer

| Nivå | Hva | Eksempel | Kost og pris |
| --- | --- | --- | --- |
| 1 Salgsprodukt | Det kunden kjøper | 6120-9010 Rammevegg m/plate per meter | Salgspris: fast eller sum av nivå 2 |
| 2 Artikkel | Det montøren plukker | Stolpe 94 med fot, toppskinne 92 960 mm | Sum av nivå 3 + håndtering |
| 3 Bestanddel | Det en artikkel er laget av | 94 × 2490 mm, 700, M10 × 65 | Kostpris per enhet |

Der det ikke finnes en artikkel, plukkes bestanddelene direkte (tekstilvegg: 43TX, 613, 520). De får da kost og pris
som en artikkel.

## 2. Kostpris per bestanddel (nivå 3), i OMS

- Kostpris er **per enhet** og er ulik fra del til del: profiler per meter, plater og trykk per m², resten per stk.
- En profil kappet til en **standardlengde** som gjenbrukes i sortimentet koster bare den kappede lengden.
- En profil tilpasset et **mål utenfor sortimentet** (på forespørsel) trenger en egen pris eller et påslag.
  Ikke bygget ennå; se åpne spørsmål.
- Kostgrunnlaget er ett av to:
  - **Kjøp**: kjøpt inn til jobben (trykk, folie, innleid tjeneste). Hele prisen er kost.
  - **Eie**: eid og gjenbrukt (profiler, plater, møbler). Anbefalt formel:
    `kost per bruk = (innkjøp / levetid i år + lagerkost per år) / antall bruk per år`.
    Uten lagerkost er dette det samme som innkjøp / totalt antall bruk.

## 3. Artikkel (nivå 2), i OMS

`kost artikkel = sum av bestanddeler × mengde + håndtering`

`håndtering = sum av tid per steg × timepris montør`

Stegene er **plukk, vask, transport og forhåndsmontering**. Ferdigmonterte enheter (stolpe med fot, skinner og
takdrager med koblinger) lagres montert, så forhåndsmontering per bruk er normalt null.

Hver artikkel og bestanddel merkes **leie** (kommer tilbake etter messen) eller **salg** (kunden beholder den, eller
den brukes opp).

## 4. Salgsprodukt (nivå 1)

### Montering hører til produktet
Montering og demontering på stedet er håndtering som hører til produktet. Den ligger i kost og pris, og er aldri en
egen linje. Arbeidstimer selges bare som egen tjeneste når selve produktet er arbeid, for eksempel hjelp med kundens
eget utstyr (henge en hylle fra IKEA på veggen). I appen heter den «Arbeidstimer, hjelp med kundens eget utstyr».

### Prisstrategi per produkt
- **Sum** (standard for alt som bygges): prisen er summen av det som faktisk bygges, altså artikler, bestanddeler
  plukket direkte og montering, hver med ferdig pris fra OMS.
- **Fast**: produktet har én pris per enhet fra OMS. Kalkylen viser likevel kost og DG.

Med sum følger prisen tegningen. Stolper som deles mellom naboer telles én gang, en tekstilvegg prises etter sin
størrelse, og en takdrager etter sine lengder og egne stolper. Derfor kan prisen per meter variere litt fra stand til
stand. Bjørn 31.10.2026: slik skal det være, prisen følger tegningen. Naboelementer deler stolper, og hver modul
(også dør og forheng) bærer en lik andel av veggstolpene. Uten tegning, for eksempel 10 vegger lagt i en handlekurv,
prises hvert element frittstående med to stolper. Kanskje skal vegger bare kunne bestilles tegnet, men da må
plantegningen åpnes for kunden. Mangler en artikkelpris, faller linjen tilbake til produktets egen pris og kalkylen viser at kosten mangler.

### Veiledende pris
OMS setter pris per artikkel. Anbefalt modell:

`veiledende pris = kost / (1 − DG-mål)`

- Mål for dekningsgrad (DG) settes **per hovedgruppe** og kan overstyres **per produkt**. Et Foga-produkt som
  prosjekteres og bygges kan ha et annet mål enn en stol som kjøpes inn, lagres og flyttes.
- DG er valgt framfor påslag fordi selgeren ser DG i kalkylen når hen gir rabatt, og da er det samme tall.

## 5. Kalkyle og tilbud

- **Kalkylen** (internt) viser per linje: pris, kost, DG og strategi (sum eller fast). Den viser også DG per gruppe,
  og kost, DB og DG for hele standen. Linjer uten kost står uten margin og telles opp. Selgeren trenger margin fordi
  det kan bli gitt rabatt.
- **Tilbudet** viser aldri kost, DB eller DG. Er et produkt dels leie og dels kjøp, får linjen en tekst til kunden,
  for eksempel «Leie av ramme, kjøp av trykt tekstil».

## 6. Hva appen trenger fra OMS

| Data | Per | Brukes til |
| --- | --- | --- |
| Produkter, varianter, grupper | Salgsprodukt | Panel, kalkyle, tilbud, plukkliste |
| Strategi (sum eller fast) | Salgsprodukt | Hvordan linjen prises |
| Pris og kost per enhet | Salgsprodukt (fast) | Pris og margin |
| Pris, kost, timer og leie/salg per enhet | Artikkel, bestanddel plukket direkte, monteringsledd | Sum-produkter |
| Kundetekst ved leie og kjøp | Salgsprodukt | Tilbudet |

I appen i dag er dette `PriceItem` og `PricingData` i `src/pricing/`, `pricing` og `cost` i katalogen
(`src/catalog/types.ts`), og `priceLine` som viser hvordan en linje prises.

## 7. Senere, eies av OMS

- Kunderabatt og prislister per kunde eller messe. Kan eksponeres via API.
- Ramme (leie) og trykk (salg, kan gjenbrukes) solgt hver for seg, slik at faste kunder kan leie rammen på nytt.

## 8. Avklart 31.10.2026

Bjørn svarte på de åpne spørsmålene. Oversikten over hele modellen, med moduler og flyt fra OMS til arbeidsordre, står i
dokumentet «Expo Quote Studio i OMS: hele modellen».

- **Foga-motoren** hører til Expo Quote Studio. Disker, podier og snekkervegger skal bygge på samme motor, i plan og 3D.
- **Tegningen er en oppskrift**: artikler og koordinater lagres med tilbudet og følger det gjennom hele systemet,
  også til plukklisten. Ikke noe vi bygger nå.
- **Lagerstatus** vises mens det tegnes, men kommer senere fra OMS og følger prosjektet.
- **Gyldighet**: prisen låses når tilbudet sendes og gjelder 30 dager. Tiden igjen til prosjektet styrer også.
- **Spesialmål**: fast påslag per kapp, til vi lager en motor som regner det selv.
- **DG-mål**: eksempeltallene brukes til ekte tall finnes.
- **Lagerkost** i eie-formelen er per enhet og år.
- **Tid**: demontering har egen tid ved siden av montering. Montørene rapporterer faktisk tid per produktgruppe, og
  etterkalkylen i OMS forbedrer tidene.
- **Takdrager** i standardlengder 1–6 m og **støttestag** per meter stemmer. 0,5 m takdrager finnes som særtilfelle,
  utenfor standardlengdene.
- **Veggpris** følger tegningen (se kapittel 4).

## 9. Åpent

1. Hvor lang er fristen før montering som et tilbud senest gjelder til?
