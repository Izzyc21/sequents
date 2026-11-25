/**
 * Fixed colours for every picture. Frames do not follow the app theme: each
 * one draws its own light paper, dark outlines and flat fills, so it reads the
 * same on the dark and the light theme.
 */
export const INK = '#1f2430'
export const PAPER = '#fffaf0'
export const CREAM = '#fff0cc'
export const SKY = '#bfe3f5'
export const MINT = '#bfe8cf'
export const PEACH = '#ffd3b8'
export const ROSE = '#ffc2cf'
export const BUTTER = '#ffe38a'
export const LAVENDER = '#d9ccf5'
export const STEEL = '#c9d1db'
export const SCREEN = '#f4f8fc'
export const SLATE = '#59627a'
export const RED = '#e5484d'
export const AMBER = '#f5a524'
export const GREEN = '#2f9e5f'
export const BLUE = '#2f6fdb'

/** Fills a piece can use; each is dark enough on its outline to stay readable. */
export type Fill = 'cream' | 'sky' | 'mint' | 'peach' | 'rose' | 'butter' | 'lavender'
export const FILLS: Record<Fill, string> = { cream: CREAM, sky: SKY, mint: MINT, peach: PEACH, rose: ROSE, butter: BUTTER, lavender: LAVENDER }

/** Outline width and the flat offset shadow shared by every piece. */
export const LINE = 3
export const SHADOW = `3px 3px 0 ${INK}`
