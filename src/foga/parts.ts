// Foga System parts as data. Source: Foga System Designer's Guide v01.07 (see docs/foga-system.md).
// Art.nr are Foga's own. Only what the guide states: no prices, no stock lengths.

/** `other`: not from Foga, but part of the wall system (HDF plates). */
export type FogaSystem = 'flex' | 'fabric' | 'other';

export type PartKind = 'profile' | 'coupling' | 'foot' | 'accessory' | 'plate';

export interface FogaPart {
  /** Foga art.nr, e.g. "873 805 22". */
  artnr: string;
  /** Foga code, e.g. "43TX", "615A". Unique; used as the key in recipes. */
  code: string;
  name: string;
  kind: PartKind;
  system: FogaSystem;
  /** Cross-section of a profile, mm (width × height as drawn in the guide). */
  section?: readonly [number, number];
}

const profile = (code: string, artnr: string, name: string, system: FogaSystem, section: readonly [number, number]): FogaPart => ({
  artnr,
  code,
  name,
  kind: 'profile',
  system,
  section,
});
const part = (code: string, artnr: string, name: string, kind: PartKind = 'coupling', system: FogaSystem = 'flex'): FogaPart => ({
  artnr,
  code,
  name,
  kind,
  system,
});

export const FOGA_PARTS: readonly FogaPart[] = [
  // Flex profiles
  profile('92', '873 051 22', 'Stolpe eller skinne', 'flex', [20, 40]),
  profile('92B', '873 171 22', 'Stolpe eller skinne med dobbel flens', 'flex', [40, 40]),
  profile('92L', '873 050 22', 'Stolpe eller skinne, 90° hjørne', 'flex', [30, 30]),
  profile('92R', '873 054 22', 'Stolpe eller skinne, 90° hjørne med hyllestøtte', 'flex', [30, 30]),
  profile('92LL', '873 048 22', 'Stolpe eller skinne, dobbelt 90° hjørne', 'flex', [60, 30]),
  profile('90', '873 040 22', 'Stolpe eller skinne, firkant', 'flex', [20, 20]),
  profile('91', '873 042 22', 'Stolpe eller skinne', 'flex', [20, 30]),
  profile('94', '873 062 22', 'Stolpe eller skinne, fire kanaler', 'flex', [40, 40]),
  profile('66', '873 032 22', 'Stolpe, seksvei', 'flex', [40, 40]),
  profile('82', '873 033 22', 'Stolpe 135°, hyllestøtte', 'flex', [48, 48]),
  profile('84', '873 037 22', 'Stolpe 135°', 'flex', [33, 48]),
  profile('85', '873 034 22', 'Stolpe 180°', 'flex', [34, 48]),
  profile('88', '873 035 22', 'Stolpe, åttevei', 'flex', [48, 48]),
  profile('101', '873 090 22', 'Terskelskinne, én kanal', 'flex', [20, 40]),
  profile('292', '873 080 22', 'Stolpe eller skinne', 'flex', [80, 20]),
  // Fabric profiles
  profile('43TX', '873 805 22', 'Tekstilprofil', 'fabric', [40, 40]),
  profile('92TX', '873 808 22', 'Tekstilprofil', 'fabric', [40, 40]),
  profile('03TX', '873 803 22', 'Tekstilprofil, enkeltsidig', 'fabric', [30, 40]),
  profile('01TX', '873 801 22', 'Tekstilprofil, veggmontert', 'fabric', [15.5, 25.5]),
  profile('60BTX', '873 813 22', 'Tekstilprofil, 60 mm', 'fabric', [60, 65.5]),
  profile('80TX', '873 810 22', 'Tekstilprofil, 80 mm for baklys', 'fabric', [80, 40]),
  profile('92LTX', '873 809 22', 'Tekstilprofil, hjørne', 'fabric', [57, 40]),
  // Couplings and connectors
  part('600', '871 003 92', 'Kobling med justerbart hode'),
  part('604', '871 031 92', 'Forlenger i kanal'),
  part('606', '871 032 92', 'Parallellkobling'),
  part('608B', '871 034 92', 'Klemkobling'),
  part('609', '871 037 92', 'Forlenger for hulprofil'),
  part('610', '871 038 92', 'Vinkelkobling 90°'),
  part('613', '871 043 92', 'Hjørnekobling, gjæret'),
  part('614', '871 044 92', 'Sterk intern kobling'),
  part('615A', '871 055 92', 'Kobling, T-hode'),
  part('615B', '871 056 92', 'Kobling, T-hode, skrue fra siden'),
  part('617', '871 045 92', 'Vinkelkobling i kanal'),
  part('618', '871 041 92', 'Parallellkobling'),
  part('625', '871 057 92', 'Vinkelkobling, gjæret'),
  part('540', '871 540 92', 'Hengeklips'),
  part('CK20', '876 773 22', 'Koblingssett 20, skrue 30 mm og 505', 'accessory', 'fabric'),
  part('CK40', '876 774 22', 'Koblingssett 40, skrue 50 mm og 505', 'accessory', 'fabric'),
  part('CK80', '876 778 22', 'Koblingssett 80, skrue 90 mm og 505', 'accessory', 'fabric'),
  part('520', '876 520 22', 'Universalbrakett / hyllebrakett', 'accessory', 'fabric'),
  part('503', '876 503 95', 'Bevel nut M5', 'accessory'),
  // Feet: threaded insert in the post + set screw as adjustable foot
  part('700', '876 700 95', 'Innsats for 90-serien, M10', 'foot'),
  part('M10x65', '896 232 95', 'Settskrue M10 × 65, sort', 'foot'),
  part('730', '876 730 92', 'Fotplate 250 × 300 × 5 mm', 'foot'),
  part('740', '876 740 92', 'Fotplate 400 × 400 × 5 mm', 'foot'),
  part('750', '876 750 93', 'Fotplate 500 × 80 × 5 mm', 'foot'),
  // Wall plates: not Foga. Lacquered HDF, ordered per RAL
  { artnr: '', code: 'HDF', name: 'Lakkert HDF-plate 3 mm', kind: 'plate', system: 'other' },
];

const BY_CODE = new Map(FOGA_PARTS.map((p) => [p.code, p]));

export function fogaPart(code: string): FogaPart {
  const p = BY_CODE.get(code);
  if (!p) throw new Error(`Ukjent Foga-del: ${code}`);
  return p;
}
