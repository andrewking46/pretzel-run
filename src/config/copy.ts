import type { ObstacleType } from './tuning.ts';

// Words. Speech bubbles when Alex bumps someone, and the line under the verdict.

export const LINES: Partial<Record<ObstacleType, string[]>> = {
  zombie: ['HEY!', 'WATCH IT!', "I'M WALKIN' HERE!", 'EYES UP, PAL!'],
  tourist: ['EXCUSE ME?!', "WE'RE TAKING A PICTURE!", 'IS THIS TIMES SQUARE?', 'SAY CHEESE!'],
  ebike: ['YO!', 'BELL MEANS MOVE!', 'ON YOUR LEFT!'],
  walker: ['SORRY, SORRY!', 'HE DOESN\'T BITE!'],
  dogs: ['WOOF!', 'ARF ARF!', 'BARK!'],
  cart: ['HEY! HOT DOGS!', 'TWO FOR FIVE!'],
  trash: ['OOF!', 'EWW!'],
  cellar: ['WHOA!', 'OOF!'],
  sawhorse: ['OOF!', 'CLOSED!'],
  steam: ['HSSSS!', 'TOO HOT!'],
  board: ['BONK!', 'OW!'],
  cab: ['HONK HONK!', 'FUGGEDABOUTIT!'],
};

export const QUIPS = {
  3: ["Alex's Usual. The counter staff know him by name.", 'The full order. Nuggets, cinnamon sugar, two Originals. A legend.', "Alex's Usual, plus enough left over to tip. Midtown conquered."],
  2: ['A pretzel and a lemonade. Respectable.', 'Pretzel + lemonade. The nuggets will have to wait.'],
  1: ["One Original. He'll be back.", 'Just the Original. Alex eats it on the escalator.'],
  0: ['Not enough for a pretzel. He asks if they do half pretzels. They do not.', 'Short on cash. Alex stares at the case for a while.'],
  sold: ['The fresh batch sold out before Alex got there.', "Sold out. Somebody else is eating Alex's pretzel."],
} as const;

export const POWERUP_NAMES = {
  slice: ['DOLLAR SLICE!', 'PIZZA POWER'],
  cat: ['BODEGA CAT!', 'CASH MAGNET'],
  express: ['EXPRESS TRAIN!', 'SKIPPING AHEAD'],
} as const;
