# Prismodell: kravspec for nytt OMS

Bjørns arbeidsplass skal bygge et nytt OMS fra bunnen av (31.10.2026). Dette dokumentet beskriver prismodellen vi
ønsker, slik at den kan brukes som kravspec. Expo Quote Studio er referansen for hva appen trenger fra OMS, og
`src/pricing/` viser appens side av modellen i kode.

**Ansvarsdeling (endret 7.11.2026).** OMS eier produktene og grupperingen, og har standardiserte stk-priser som appen
henter. Kostmodellen for det som prosjekteres og bygges eier appen selv: kostmotoren i `src/cost/`, beskrevet i
[kostmodell.md](kostmodell.md). Tidligere (31.10.2026) skulle OMS regne all kost og appen bare få ferdige tall; Bjørn
endret det 7.11.2026. For et produkt som prises som sum av artikler legger appen sammen det som faktisk er tegnet.

Alle tall i appen i dag er eksempeltall, unntatt veggprisen 765 kr per meter (Bjørn 7.11.2026). Kost og tid for
systemvegg, takdrager og tekstilvegg kommer fra kostmotoren og kostgrunnlaget. Prisen på katalogprodukter kommer fra
`src/catalog/defaultCatalog.ts`; tekstilveggen prises av motoren.

## 1. Tre nivåer

| Nivå | Hva | Eksempel | Kost og pris |
| --- | --- | --- | --- |
| 1 Salgsprodukt | Det kunden kjøper | 6120-9010 Rammevegg m/plate per meter | Salgspris: fast eller sum av nivå 2 |
| 2 Artikkel | Det montøren plukker | Stolpe 94 med fot, toppskinne 92 960 mm | Sum av nivå 3 + håndtering |
| 3 Bestanddel | Det en artikkel er laget av | 94 × 2490 mm, 700, M10 × 65 | Kostpris per enhet |

Der det ikke finnes en artikkel, plukkes bestanddelene direkte (tekstilvegg: 43TX, 92LTX, 617, 609, 604, 520, 740, 730; stag 90 med 600 er
en ferdig enhet). De får da kost og pris som en artikkel.

## 2. Kost per bestanddel (nivå 3), fra kostmotoren

Kost regnes i appens kostmotor, og reglene står i [kostmodell.md](kostmodell.md). Kort fortalt:

- Kost er **direkte kost per enhet**: profiler per meter, plater og trykk per m², resten per stk. Indirekte kost er ett
  påslag i prosent, vist som egen linje i kalkylen.
- **Eie** (profiler, plater, koblinger): innkjøp fordelt på levetid og bruk per år per artikkelgruppe, rente og tap per
  jobb. **Kjøp** (trykk, folie): innkjøp med svinn.
- En profil kappet til en **standardlengde** koster bare den kappede lengden. En profil kappet til et **mål utenfor
  sortimentet** er spesialkapp med egen regel (byggeregel X9).

## 3. Artikkel (nivå 2)

`kost artikkel = sum av bestanddeler × mengde + håndtering`

`håndtering = personminutter per steg × timekost`, regnet i kostmotoren.

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
Bestemt 7.11.2026 (Bjørn): **alt som finnes i katalogen og nettbutikken selges til fast stk-pris fra OMS**, også Foga-
vegger, dører, forheng og takdragere. Tilbudet avviker aldri fra OMS. Kostmotoren regner kost, DG og estimert
arbeidstid for det som faktisk er tegnet, og viser det bare i kalkylen.

- **Fast** (alt i katalogen): én pris per enhet fra OMS, for eksempel 765 kr per meter vegg. Kalkylen viser kost og
  DG fra det som er bygget: stolper som deles mellom naboer telles én gang i kosten, men prisen per meter er den samme.
- **Sum** (bare det katalogen ikke dekker): tilpassede størrelser fra standtegningen, for eksempel en tekstilramme i
  egne mål eller et spesialkapp. Prisen er summen av det som bygges, med kost fra kostmotoren og pris fra DG-målet.

Tidligere (31.10.2026) skulle veggprisen følge tegningen, som sum av artikler. Det gjelder ikke lenger. Mangler en
artikkel i prislisten, står linjen med sin pris og uten kost, og kalkylen teller den opp.

### Veiledende pris
Fast pris per stk kommer fra OMS. For sum-produkter (tilpassede mål) foreslår appen pris fra direkte kost og DG-mål:

`veiledende pris = direkte kost × (1 + indirekte) / (1 − DG-mål)`

Den indirekte kosten (eksempel 10 %, administrasjon) ligger inne i prisen, ikke som eget gebyr; katalogen er regnet
slik (Bjørn 7.11.2026). Ordrekost (startkost trykk, administrasjon, levering) er kost én gang per tilbud og ligger
ikke i noen pris ([kostmodell.md](kostmodell.md)).

- Mål for dekningsgrad (DG) settes **per hovedgruppe** og kan overstyres **per produkt**. Et Foga-produkt som
  prosjekteres og bygges kan ha et annet mål enn en stol som kjøpes inn, lagres og flyttes.
- DG er valgt framfor påslag fordi selgeren ser DG i kalkylen når hen gir rabatt, og da er det samme tall.

### Tid per håndteringssteg
Tid lagres i minutter per steg: **plukk, vask, transport, forhåndsmontering, montering og demontering**. Demontering har
egen tid (Bjørn 31.10.2026). Tid er både kost (personminutter × timekost, regnet i kostmotoren) og plan på arbeidsordren, så den følger
hver artikkel og hvert produkt som egen størrelse, også når kronene er regnet ut på forhånd. I appen er det `time` på
`PriceItem` (sum-produkter) og på produktet (faste produkter).

## 5. Kalkyle og tilbud

- **Kalkylen** (internt) viser per linje: pris, kost, DG og strategi (sum eller fast). Den viser også DG per gruppe,
  og kost, DB og DG for hele standen, og indirekte kost som egen linje med det som er igjen etter den. Linjer uten kost står uten margin og telles opp. Selgeren trenger margin fordi
  det kan bli gitt rabatt.
- **Gyldighet**: tilbudet gjelder 30 dager fra det sendes, men aldri lenger enn 14 dager før montering
  (`rules.quote`). Datoene for montering, åpning og demontering ligger på prosjektet. De er plassholdere i appen og
  skal komme fra prosjektet i OMS via API.
- **Arbeidsordren** (prototype i appen) viser leveranse, forventet tid fra ordren påbegynnes til den er signert
  levert (plukk, forhåndsmontering, transport og montering) per produktgruppe, plukkliste, standskisse og trykkliste.
  Vask og demontering skjer etter messen. De ligger i systemet for planlegging, men vises ikke på arbeidsordren
  (Bjørn 31.10.2026). Arbeidsordren kan filtreres på produktgruppe, slik at tepper går til teppelegger og
  standkonstruksjon til standbygger. Grupper som er filtrert bort dempes i skissen. Mannskap og tidspunkt settes i OMS.
- **Fakturamottaker** per linje: utstiller eller arrangør. Bare standvegger og takdragerne som følger dem kan gå til arrangøren, og da er de ikke på
  tilbudet, plukklisten eller arbeidsordren, men i en egen blokk i kalkylen. Farge på en slik vegg er produktet
  Platebytte standvegg, som utstilleren betaler. Regler og grunner: docs/vegger.md.
- **Tilbudet** viser aldri kost, DB eller DG. Er et produkt dels leie og dels kjøp, får linjen en tekst til kunden,
  for eksempel «Leie av ramme, kjøp av tekstil».
- **Flere linjer, én i tilbudet.** Tekstilvegger er to linjer i kalkylen, ramme (leie) og tekstil (salg), og én linje
  i tilbudet med summen av begge (Bjørn 31.10.2026). Én tilbudslinje per rammestørrelse, «Tekstilvegg 3970 × 2540
  mm», med egen pris (Bjørn 7.11.2026: like priser for ulike størrelser ser rart ut). Kunden kan ha duken fra før: da
  er tekstillinjen bare montering.

## 6. Hva appen trenger fra OMS

| Data | Per | Brukes til |
| --- | --- | --- |
| Produkter, varianter, grupper | Salgsprodukt | Panel, kalkyle, tilbud, plukkliste |
| Strategi (sum eller fast) | Salgsprodukt | Hvordan linjen prises |
| Pris og kost per enhet | Salgsprodukt (fast) | Pris og margin |
| Leie/salg per enhet (kost og tid regner appen) | Artikkel, bestanddel plukket direkte, monteringsledd | Sum-produkter |
| Kundetekst ved leie og kjøp | Salgsprodukt | Tilbudet |
| Hvem betaler standveggene, arrangørens farge | Prosjekt (messe) | Fakturamottaker, platebytte |

I appen i dag er dette `PriceItem` (`src/cost/items.ts`) og `PricingData` (`src/pricing/data.ts`), `pricing` og `cost` i katalogen
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
- **Spesialmål**: fast påslag per kapp, til motoren regner det selv. Endret 7.11.2026: kostmotoren har egen regel for
  spesialkapp (kostmodell.md).
- **DG-mål**: eksempeltallene brukes til ekte tall finnes.
- **Lagerkost** i eie-formelen er per enhet og år. Endret 7.11.2026: lager er indirekte kost, i påslaget.
- **Tid**: demontering har egen tid ved siden av montering. Montørene rapporterer faktisk tid per produktgruppe, og
  etterkalkylen i OMS forbedrer tidene.
- **Takdrager** i standardlengder 1–6 m og **støttestag** per meter stemmer. 0,5 m takdrager finnes som særtilfelle,
  utenfor standardlengdene.
- **Veggpris** følger tegningen. Endret 7.11.2026: veggen selges til fast OMS-pris per meter (kapittel 4).

## 9. Åpent

Ingenting akkurat nå. Fristen før montering er 14 dager.
