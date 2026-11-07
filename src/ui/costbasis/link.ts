// A path from «Slik er det regnet» («parametere.labour», «tider.stolpe-94»): App listens, switches to the Kostgrunnlag
// page and the page lights the rows the path names.
export const BASIS_EVENT = 'kostgrunnlag'

export const showInBasis = (path: string) => window.dispatchEvent(new CustomEvent<string>(BASIS_EVENT, { detail: path }))

/** Today as YYYY-MM-DD: the date of a new version and of a note on a number. */
export const today = () => new Date().toISOString().slice(0, 10)
