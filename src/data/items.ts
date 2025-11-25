import type { Essence, Molecule } from '../logic/ItemLib';

// Data shape: rarity is optional and numeric (1..4). It is normalized in Lib to string rarity.
export const itemDefinitions: Record<string, { name: string; volume: number; essence: Essence; rarity?: number; molecule?: Molecule; devOnly?: boolean }> = {
  rat_remains: {
    name: 'Distorted Remains',
    volume: 1,
    essence: { red: 2 },
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'red', x: 1, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      ],
    },
  },
  flower_remains: {
    name: 'Flower Human Remains',
    volume: 1,
    essence: { blue: 2 },
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'blue', x: 0, y: 0 },
        { color: 'blue', x: 1, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      ],
    },
  },
  enamel_mug: {
    name: 'Mug',
    volume: 2,
    essence: { red: 4 },
    rarity: 1,
  },
  mechanical_clock: {
    name: 'Clock',
    volume: 5,
    essence: { red: 5, green: 1, blue: 5 },
    rarity: 2,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'blue', x: 1, y: 0 },
        { color: 'red', x: 2, y: 0 },
        { color: 'blue', x: 2, y: -1 },
        { color: 'red', x: 1, y: -1 },
        { color: 'blue', x: 0, y: -1 },
        { color: 'green', x: 1, y: -2 }, // center
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 2, y: 0 }, to: { x: 2, y: -1 } },
        { from: { x: 2, y: -1 }, to: { x: 1, y: -1 } },
        { from: { x: 1, y: -1 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: -1 }, to: { x: 0, y: 0 } },
      ],
    },
  },
  porcelain_figurine: {
    name: 'Figurine',
    volume: 4,
    essence: { red: 3, blue: 5 },
    rarity: 2,
    molecule: {
      atoms: [
        // Core blue body
        { color: 'blue', x: 0, y: 0 },
        { color: 'blue', x: 1, y: 0 },
        { color: 'blue', x: 0, y: -1 },
        { color: 'blue', x: -1, y: 0 },
        // Indigo highlight influencing surrounding reds/blues
        { color: 'indigo', x: 0, y: 1 },
        // Red accents
        { color: 'red', x: 1, y: -1 },
        { color: 'red', x: -1, y: 1 },
        { color: 'red', x: 1, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: -1, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      ],
    },
  },
  document_holder: {
    name: 'Document Holder',
    volume: 2,
    essence: { red: 3, green: 1 },
  },
  wrench: {
    name: 'Wrench',
    volume: 1,
    essence: { red: 2 },
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'crimson', x: 1, y: 0 },
        { color: 'red', x: 1, y: -1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: -1 } },
      ],
    },
  },
  canned_sprats: {
    name: 'Canned Sprats',
    volume: 2,
    essence: { green: 1, blue: 3 },
  },
  rotary_phone: {
    name: 'Rotary Phone',
    volume: 6,
    essence: { red: 8, green: 4 },
    rarity: 3,
  },
  iodine_bottle: {
    name: 'Iodine Solution',
    volume: 1,
    essence: { green: 1, blue: 2 },
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'blue', x: 0, y: 0 },
        { color: 'blue', x: 1, y: -1 },
        { color: 'green', x: 0, y: -1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
      ],
    },
  },
  crystal_decanter: {
    name: 'Decanter',
    volume: 5,
    essence: { red: 6, blue: 2, yellow: 2 },
    rarity: 2,
  },

  vinyl_record: {
    name: 'Vinyl Record',
    volume: 2,
    essence: { red: 2, green: 5, blue: 3 },
    rarity: 1,
    molecule: {
      atoms: [
        // Center atom
        { color: 'green', x: 0, y: 0 },
        // Ring 1 (radius 1)
        { color: 'green', x: 1, y: 0 },
        { color: 'green', x: 1, y: -1 },
        { color: 'green', x: 0, y: -1 },
        { color: 'green', x: -1, y: 0 },
        { color: 'green', x: -1, y: 1 },
        { color: 'green', x: 0, y: 1 },
        // Ring 2 (radius 2), starting from the right and going counter-clockwise
        { color: 'green', x: 2, y: 0 },
        { color: 'green', x: 2, y: -1 },
        { color: 'green', x: 2, y: -2 },
        { color: 'green', x: 1, y: -2 },
        { color: 'green', x: 0, y: -2 },
        { color: 'red', x: -1, y: -1 },
        { color: 'red', x: -2, y: 0 },
        { color: 'red', x: -2, y: 1 },
        { color: 'blue', x: -2, y: 2 },
        { color: 'blue', x: -1, y: 2 },
        { color: 'blue', x: 0, y: 2 },
        { color: 'blue', x: 1, y: 1 },
      ],
      connections: [
        // Center to ring 1
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        // Ring 1 to ring 2
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 1, y: -1 }, to: { x: 2, y: -1 } },
        { from: { x: 1, y: -1 }, to: { x: 2, y: -2 } },
        { from: { x: 0, y: -1 }, to: { x: 1, y: -2 } },
        { from: { x: 0, y: -1 }, to: { x: 0, y: -2 } },
        { from: { x: -1, y: 0 }, to: { x: -1, y: -1 } },
        { from: { x: -1, y: 0 }, to: { x: -2, y: 0 } },
        { from: { x: -1, y: 1 }, to: { x: -2, y: 1 } },
        { from: { x: -1, y: 1 }, to: { x: -2, y: 2 } },
        { from: { x: 0, y: 1 }, to: { x: -1, y: 2 } },
        { from: { x: 0, y: 1 }, to: { x: 0, y: 2 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
        // Additional ring 2 connections
        { from: { x: 2, y: 0 }, to: { x: 2, y: -1 } },
        { from: { x: 2, y: -1 }, to: { x: 2, y: -2 } },
        { from: { x: 2, y: -2 }, to: { x: 1, y: -2 } },
        { from: { x: 1, y: -2 }, to: { x: 0, y: -2 } },
        { from: { x: -1, y: -1 }, to: { x: -2, y: 0 } },
        { from: { x: -2, y: 0 }, to: { x: -2, y: 1 } },
        { from: { x: -2, y: 1 }, to: { x: -2, y: 2 } },
        { from: { x: -2, y: 2 }, to: { x: -1, y: 2 } },
        { from: { x: -1, y: 2 }, to: { x: 0, y: 2 } },
        { from: { x: 0, y: 2 }, to: { x: 1, y: 1 } },
      ],
    },
  },
  soviet_watch: {
    name: 'Watch',
    volume: 1,
    essence: { red: 2, green: 2, blue: 4, yellow: 2 },
    rarity: 2,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'green', x: 1, y: 0 },
        { color: 'blue', x: 0, y: -1 },
        { color: 'yellow', x: -1, y: 0 },
        { color: 'yellow', x: -1, y: 1 },
        { color: 'yellow', x: 0, y: 1 },
        { color: 'yellow', x: 1, y: -1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
      ],
    },
  },
  vintage_camera: {
    name: 'Camera',
    volume: 5,
    essence: { red: 4, green: 4, blue: 8, yellow: 3 },
    rarity: 3,
    molecule: {
      atoms: [
        // Gold housing at the center
        { color: 'gold', x: 0, y: 0 },
        // Primary RGB around it
        { color: 'red', x: 1, y: 0 },
        { color: 'green', x: -1, y: 0 },
        { color: 'blue', x: 0, y: -1 },
        // Color-changing highlights for all three primaries
        { color: 'indigo', x: 1, y: -1 },  // pushes toward blue
        { color: 'emerald', x: -1, y: 1 }, // pushes toward green
        { color: 'crimson', x: 1, y: 1 },  // pushes toward red
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
        { from: { x: -1, y: 0 }, to: { x: -1, y: 1 } },
      ],
    },
  },
  fur_shapka: {
    name: 'Shapka',
    volume: 3,
    essence: { red: 2, green: 6, blue: 2 },
  },
  condensed_milk: {
    name: 'Condensed Milk',
    volume: 2,
    essence: { red: 1, green: 5, blue: 2 },
  },
  soviet_champagne: {
    name: 'Soviet Champagne',
    volume: 4,
    essence: { red: 2, green: 6, blue: 3 },
  },
  vodka_bottle: {
    name: 'Vodka Bottle',
    volume: 4,
    essence: { red: 3, green: 5, blue: 2 },
  },
  tea_brick: {
    name: 'Tea Brick',
    volume: 3,
    essence: { red: 1, green: 7, blue: 2 },
    molecule: {
      atoms: [
        { color: 'green', x: 0, y: 0 },
        { color: 'green', x: 1, y: 0 },
        { color: 'green', x: 0, y: -1 },
        { color: 'green', x: 1, y: -1 },
        { color: 'green', x: 2, y: -1 },
        { color: 'green', x: 1, y: -2 },
        { color: 'green', x: 2, y: -2 },
        { color: 'red', x: 3, y: -2 },
        { color: 'blue', x: 2, y: -3 },
        { color: 'blue', x: 3, y: -3 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: -1 }, to: { x: 1, y: -1 } },
        { from: { x: 1, y: -1 }, to: { x: 2, y: -1 } },
        { from: { x: 1, y: -1 }, to: { x: 1, y: -2 } },
        { from: { x: 2, y: -1 }, to: { x: 2, y: -2 } },
        { from: { x: 1, y: -2 }, to: { x: 2, y: -2 } },
        { from: { x: 2, y: -2 }, to: { x: 3, y: -2 } },
        { from: { x: 2, y: -2 }, to: { x: 2, y: -3 } },
        { from: { x: 2, y: -3 }, to: { x: 3, y: -3 } },
        { from: { x: 3, y: -2 }, to: { x: 3, y: -3 } },
      ],
    },
  },
  old_cigarettes: {
    name: 'Cigarettes',
    volume: 1,
    essence: { red: 2, green: 3, blue: 1 },
    molecule: {
      atoms: [
        { color: 'green', x: 0, y: 0 },
        { color: 'green', x: 1, y: 0 },
        { color: 'green', x: 2, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
      ],
    },
  },
  honey_jar: {
    name: 'Honey Jar',
    volume: 3,
    essence: { red: 1, green: 7, blue: 2 },
  },
  pickled_vegetables: {
    name: 'Pickled Vegetables',
    volume: 5,
    essence: { red: 2, green: 8, blue: 3 },
  },
  multimeter: {
    name: 'Multimeter',
    volume: 3,
    essence: { red: 2, green: 3, blue: 7 },
  },
  hand_drill: {
    name: 'Hand Drill',
    volume: 5,
    essence: { red: 6, green: 4, blue: 2 },
  },
  work_gloves: {
    name: 'Work Gloves',
    volume: 1,
    essence: { red: 1, green: 4, blue: 1 },
  },
  rubber_boots: {
    name: 'Rubber Boot',
    volume: 3,
    essence: { red: 2, green: 5, blue: 2 },
  },
  lab_coat: {
    name: 'Lab Coat',
    volume: 2,
    essence: { red: 1, green: 5, blue: 2 },
  },
  protective_goggles: {
    name: 'Protective Goggles',
    volume: 1,
    essence: { red: 1, green: 3, blue: 2 },
  },
  geiger_counter: {
    name: 'Geiger Counter',
    volume: 6,
    essence: { red: 2, green: 4, blue: 10, yellow: 3 },
    rarity: 3,
  },
  gas_mask_gp5: {
    name: 'Gas Mask GP-5',
    volume: 8,
    essence: { red: 4, green: 6, blue: 6, yellow: 2 },
    rarity: 2,
    molecule: {
      atoms: [
        // Emerald filter core
        { color: 'emerald', x: 0, y: 0 },
        // Surrounding protective shell
        { color: 'green', x: 1, y: 0 },
        { color: 'green', x: 0, y: -1 },
        { color: 'blue', x: -1, y: 0 },
        { color: 'blue', x: 0, y: 1 },
        // Gold valve and indigo lens
        { color: 'gold', x: -1, y: 1 },
        { color: 'indigo', x: 1, y: -1 },
        // Crimson strap anchor
        { color: 'crimson', x: 1, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        { from: { x: -1, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
      ],
    },
  },
  chemical_kit: {
    name: 'Chemical Kit',
    volume: 9,
    essence: { red: 3, green: 8, blue: 7 },
    rarity: 3,
  },
  soviet_flashlight: {
    name: 'Soviet Flashlight',
    volume: 3,
    essence: { red: 2, green: 3, blue: 6 },
  },
  field_phone: {
    name: 'Field Phone',
    volume: 12,
    essence: { red: 4, green: 5, blue: 12, yellow: 3 },
  },
  signal_flare: {
    name: 'Signal Flare',
    volume: 1,
    essence: { red: 4, green: 1, blue: 1 },
  },
  dosimeter: {
    name: 'Dosimeter',
    volume: 4,
    essence: { red: 2, green: 3, blue: 9, yellow: 2 },
  },
  lucky_coin: {
    name: 'Coin',
    volume: 1,
    essence: { red: 1, green: 1, blue: 3, yellow: 1 },
    molecule: {
      atoms: [
        { color: 'yellow', x: 0, y: 0 },
      ],
      connections: [],
    },
  },
  photo_album: {
    name: 'Photo Album',
    volume: 4,
    essence: { red: 2, green: 5, blue: 3 },
  },
  foreign_currency: {
    name: 'Banknotes',
    volume: 1,
    essence: { red: 1, green: 2, blue: 3 },
  },
  olympic_badge: {
    name: 'Olympic Badge',
    volume: 1,
    essence: { red: 1, green: 2, blue: 3, yellow: 1 },
  },
  soviet_knife: {
    name: 'Knife',
    volume: 2,
    essence: { red: 6, green: 2, blue: 1 },
  },
  mess_kit: {
    name: 'Mess Kit',
    volume: 4,
    essence: { red: 3, green: 4, blue: 3 },
  },
  canvas_tent: {
    name: 'Tent',
    volume: 25,
    essence: { red: 6, green: 12, blue: 8 },
    rarity: 4,
    molecule: {
      atoms: [
        // Gold ridge pole with emerald support
        { color: 'gold', x: 0, y: 0 },
        { color: 'emerald', x: 0, y: 1 },
        // Tent fabric (mostly green) with blue edges and red stakes
        { color: 'green', x: 1, y: 0 },
        { color: 'green', x: 0, y: -1 },
        { color: 'green', x: -1, y: 0 },
        { color: 'green', x: -1, y: 1 },
        { color: 'blue', x: 1, y: -1 },
        { color: 'blue', x: 2, y: -1 },
        { color: 'red', x: 2, y: 0 },
        { color: 'red', x: 2, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: -1, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 1, y: -1 }, to: { x: 2, y: -1 } },
        { from: { x: 2, y: -1 }, to: { x: 2, y: 0 } },
        { from: { x: 2, y: 0 }, to: { x: 2, y: 1 } },
      ],
    },
  },
  sleeping_bag: {
    name: 'Sleeping Bag',
    volume: 18,
    essence: { red: 4, green: 10, blue: 6 },
  },
  bandage_tin: {
    name: 'Bandage Tin',
    volume: 1,
    essence: { red: 1, green: 3, blue: 1 },
  },
  signal_pistol: {
    name: 'Signal Pistol',
    volume: 3,
    essence: { red: 7, green: 2, blue: 2 },
  },
  smoke_grenade: {
    name: 'Smoke Grenade',
    volume: 2,
    essence: { red: 5, green: 2, blue: 2 },
  },
  door_handle: {
    name: 'Door Handle',
    volume: 2,
    essence: { red: 2, green: 2, blue: 2 },
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'green', x: 1, y: 0 },
        { color: 'blue', x: 0, y: -1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
      ],
    },
  },
  window_latch: {
    name: 'Window Latch',
    volume: 1,
    essence: { red: 1, green: 2, blue: 1 },
    molecule: {
      atoms: [
        { color: 'green', x: 0, y: 0 },
        { color: 'green', x: 0, y: -1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
      ],
    },
  },
  padlock: {
    name: 'Padlock',
    volume: 1,
    essence: { red: 2, green: 1, blue: 1 },
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'red', x: 0, y: -1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
      ],
    },
  },
  chain_link: {
    name: 'Chain',
    volume: 2,
    essence: { red: 3, green: 1, blue: 1 },
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'red', x: 1, y: 0 },
        { color: 'red', x: 2, y: 0 },
        { color: 'red', x: 3, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 2, y: 0 }, to: { x: 3, y: 0 } },
      ],
    },
  },
  light_bulb: {
    name: 'Lightbulb',
    volume: 1,
    essence: { red: 1, green: 1, blue: 3 },
    molecule: {
      atoms: [
        { color: 'blue', x: 0, y: 0 },
      ],
      connections: [],
    },
  },
  fuse_box: {
    name: 'Fuse Box',
    volume: 3,
    essence: { red: 2, green: 2, blue: 6 },
  },
  electrical_wire: {
    name: 'Wire',
    volume: 2,
    essence: { red: 1, green: 2, blue: 3 },
  },
  insulation_tape: {
    name: 'Tape',
    volume: 1,
    essence: { red: 1, green: 2, blue: 2 },
    molecule: {
      atoms: [
        { color: 'green', x: 0, y: 0 },
        { color: 'green', x: 1, y: 0 },
        { color: 'blue', x: 1, y: -1 },
        { color: 'blue', x: 1, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
      ],
    },
  },
  inventory_keys: {
    name: 'Keys',
    volume: 1,
    essence: { red: 1, green: 1, blue: 2 },
    molecule: {
      atoms: [
        { color: 'gold', x: 0, y: 0 },
        { color: 'red', x: 1, y: 0 },
        { color: 'blue', x: 0, y: -1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
      ],
    },
  },
  bicycle_pedal: {
    name: 'Bicycle Pedal',
    volume: 1,
    essence: { red: 2, green: 1, blue: 1 },
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'red', x: 1, y: -1 },
        { color: 'red', x: -1, y: -1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: -1 } },
      ],
    },
  },
  calipers: {
    name: 'Calipers',
    volume: 2,
    essence: { red: 3, green: 2, blue: 2 },
  },
  hammer: {
    name: 'Hammer',
    volume: 3,
    essence: { red: 6, green: 2, blue: 1 },
  },
  vase: {
    name: 'Vase',
    volume: 3,
    essence: { red: 2, green: 4, blue: 3 },
  },
  handkerchief: {
    name: 'Handkerchief',
    volume: 1,
    essence: { red: 1, green: 3, blue: 1 },
  },
  ruined_ammo_box: {
    name: 'Ruined Ammo Box',
    volume: 4,
    essence: { red: 4, green: 1, blue: 1 },
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'green', x: 1, y: 0 },
        { color: 'blue', x: 0, y: -1 },
        { color: 'gray', x: -1, y: 0 },
        { color: 'gray', x: -1, y: 1 },
        { color: 'gray', x: 0, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: -1, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: -1, y: 1 }, to: { x: 0, y: 1 } },
      ],
    },
  },
  aluminium_bowl: {
    name: 'Aluminium Bowl',
    volume: 2,
    essence: { red: 2, green: 3, blue: 1 },
  },
  ruined_ammo_cartridge: {
    name: 'Ruined Ammo Cartridge',
    volume: 1,
    essence: { red: 3, green: 1, blue: 1 },
  },
  tin_grain_box: {
    name: 'Tin Box',
    volume: 3,
    essence: { red: 2, green: 4, blue: 2 },
  },
  portable_radio: {
    name: 'Portable Radio',
    volume: 6,
    essence: { red: 3, green: 4, blue: 10, yellow: 2 },
    rarity: 3,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'green', x: 1, y: 0 },
        { color: 'blue', x: 0, y: -1 },
        { color: 'orange', x: -1, y: 0 },
        { color: 'orange', x: -1, y: 1 },
        { color: 'orange', x: 0, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: -1, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: -1, y: 1 }, to: { x: 0, y: 1 } },
      ],
    },
  },
  tabletop_lamp: {
    name: 'Lamp',
    volume: 4,
    essence: { red: 2, green: 3, blue: 6 },
  },
  red_rubber_ball: {
    name: 'Red Rubber Ball',
    volume: 1,
    essence: { red: 2, green: 1, blue: 1 },
  },
  christmas_ball: {
    name: 'Christmas Ball',
    volume: 1,
    essence: { red: 1, green: 2, blue: 1 },
  },
  frying_pan: {
    name: 'Frying Pan',
    volume: 3,
    essence: { red: 4, green: 2, blue: 1 },
  },
  ruined_ammunition_7_62: {
    name: 'Ruined Ammunition 7.62',
    volume: 1,
    essence: { red: 3, green: 1, blue: 1 },
  },
  // Dev-only single-essence atoms for molecule editor
  dev_atom_red: {
    name: 'Dev Atom (Red)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'red', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_green: {
    name: 'Dev Atom (Green)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'green', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_blue: {
    name: 'Dev Atom (Blue)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'blue', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_yellow: {
    name: 'Dev Atom (Yellow)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'yellow', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_indigo: {
    name: 'Dev Atom (Indigo)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'indigo', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_crimson: {
    name: 'Dev Atom (Crimson)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'crimson', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_emerald: {
    name: 'Dev Atom (Emerald)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'emerald', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_gold: {
    name: 'Dev Atom (Gold)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'gold', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_orange: {
    name: 'Dev Atom (Orange)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'orange', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
  dev_atom_gray: {
    name: 'Dev Atom (Gray)',
    volume: 0,
    essence: {},
    rarity: 1,
    molecule: {
      atoms: [{ color: 'gray', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
};

export default itemDefinitions;
