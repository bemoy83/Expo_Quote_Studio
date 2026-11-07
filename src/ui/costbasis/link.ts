// A path from «Slik er det regnet» («parametere.labour», «tider.stolpe-94»): App listens, switches to the Kostgrunnlag
// page and the page lights the rows the path names.
export const BASIS_EVENT = 'kostgrunnlag'

export const showInBasis = (path: string) => window.dispatchEvent(new CustomEvent<string>(BASIS_EVENT, { detail: path }))

