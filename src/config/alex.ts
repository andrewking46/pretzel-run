// What Alex looks like in the game: he works in finance, so he runs for pretzels in a suit.
export const ALEX_LOOK = {
  /** fair */
  skin: '#f3d6be',
  /** brown */
  hair: '#5b3a22',
  hairStyle: 'short' as const,
  /** brown */
  eyes: '#5a3920',
  /** navy suit, white shirt, red tie */
  topStyle: 'suit' as const,
  top: '#26324a',
  shirt: '#f4f6fa',
  tie: '#a3242f',
  pants: '#26324a',
  /** brown leather dress shoes */
  shoes: '#5a3420',
  dressShoes: true,
  glasses: false,
  /** a little big-headed, so he reads from behind */
  headScale: 1.32,
  height: 1.8,
};

/** Optional circular face photo for the title, receipt and HUD marker (public/alex-face.png). */
export const ALEX_FACE_URL = 'alex-face.png';
