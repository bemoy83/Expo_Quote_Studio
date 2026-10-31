// How each element is built from Foga parts. Only confirmed recipes; anything unknown is reported by the engine
// as an open question instead of guessed. Question numbers refer to docs/foga-system.md § "Åpne spørsmål".

export interface FrameRecipe {
  /** Frame profile code, cut mitred to outer size (2W + 2H). */
  profile: string;
  /** Corner coupling, one per corner (4 per frame). */
  corner: string;
  /** Cross brace: profile and couplings per brace. Null until confirmed. */
  brace: { profile: string; coupling: string; perBrace: number } | null;
}

/**
 * Walls, posts, beams and openings have no recipe yet: how they are built in Flex is open (questions 1–5, 7).
 * They get one here when answered; until then the engine lists them as open items.
 */
export interface Recipes {
  frame: FrameRecipe;
}

/** Bjørn 31.10.2026: textile walls are 43TX. The guide: 43TX corners with 613, mitred. */
export const RECIPES: Recipes = {
  frame: { profile: '43TX', corner: '613', brace: null },
};

/** Open questions the engine can point to. */
export const QUESTIONS = {
  post: { no: 1, text: 'Stolpeprofil for ende, rett, hjørne, T og kryss' },
  rails: { no: 2, text: 'Topp- og bunnskinne og kobling mot stolpen' },
  plate: { no: 3, text: 'Hvordan veggplaten står i kanalen, og tykkelse' },
  feet: { no: 4, text: 'Føtter per stolpe' },
  beam: { no: 5, text: 'Takdragerprofil og feste til stolpe' },
  brace: { no: 6, text: 'Tverrstag i 43TX-rammen: profil og kobling' },
  opening: { no: 7, text: 'Dør og overstykke i Foga' },
  stock: { no: 8, text: 'Kappede lengder eller hele stenger' },
} as const;

export type QuestionId = keyof typeof QUESTIONS;
