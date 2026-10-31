// Build rules as data. Approved by the owner 30.10.2026 (F2). Change values here, never in calc code.
// Lengths in metres unless the field says mm.

export interface InFrameParams {
  /** Deduction for wall or beam on both sides, total mm (2 × 10). */
  side: number;
  /** Mounting clearance in the width, mm. */
  air: number;
  /** System wall height without feet, mm. */
  wallH: number;
  /** Adjustable feet, mm. */
  feet: number;
  /** Bleed per side at full size, mm. WorkMan spec 20, internally often 14. */
  bleed: number;
  /** Scale the customer delivers the print file in, %. */
  scale: number;
  /** Frame profile width, subtracted from brace length, mm. */
  prof: number;
  /** Max distance between cross braces, mm. */
  stag: number;
}

export interface Rules {
  approved: string;
  wall: {
    cc: number;
    height: number;
    feet: number;
    post: number;
    profile: { length: number; top: number; bottom: number; thickness: number };
    /** Wall plate size, mm. */
    plate: { width: number; height: number };
  };
  beam: { max: number; height: number; thickness: number };
  /** `grid`: free-standing textile walls are drawn and sized on this grid (the elevation grid), m. */
  textile: { depth: number; minWidth: number; grid: number; inFrame: InFrameParams };
  door: { swing: number };
  floor: { cell: number };
  /** A quote holds `validDays` from it is sent, but never later than `beforeMount` days before montering. */
  quote: { validDays: number; beforeMount: number };
  /** VAT used for the inkl. mva. figure. Prices are always eks. mva. */
  vat: number;
}

export const RULES: Rules = {
  approved: '30.10.2026',
  wall: {
    cc: 1,
    height: 2.49,
    feet: 0.05,
    post: 0.04,
    profile: { length: 0.96, top: 0.04, bottom: 0.03, thickness: 0.02 },
    plate: { width: 960, height: 2420 },
  },
  beam: { max: 6, height: 0.08, thickness: 0.02 },
  textile: {
    depth: 0.04,
    minWidth: 0.5,
    grid: 0.25,
    inFrame: { side: 20, air: 10, wallH: 2490, feet: 50, bleed: 20, scale: 10, prof: 40, stag: 1000 },
  },
  door: { swing: 0.9 },
  floor: { cell: 0.5 },
  quote: { validDays: 30, beforeMount: 14 },
  vat: 0.25,
};

/** Full wall height including feet (2540 mm). */
export const wallHeight = (r: Rules) => r.wall.height + r.wall.feet;
