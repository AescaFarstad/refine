import { processItemDefinitions } from '../logic/ItemLib';
import type { Essence, Molecule } from '../logic/ItemLib';
import remainsDefinitions from './items_remains';

const blankMolecule: Molecule = {
  atoms: [{ color: 'gray', x: 0, y: 0 }],
  connections: [],
};

// Data shape: rarity is optional and numeric (1..4). It is normalized in Lib to string rarity.
const rawDefinitions: Record<string, { name: string; volume: number; essence?: Essence; rarity?: number; molecule?: Molecule; devOnly?: boolean }> = {
  enamel_mug: {
    name: 'Mug',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'red', x: -2, y: 0 },
        { color: 'red', x: -3, y: 2 },
      ],
      connections: [
        { from: { x: -2, y: 0 }, to: { x: -3, y: 2 } },
      ],
    },
  },
  mechanical_clock: {
    name: 'Clock',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  porcelain_figurine: {
    name: 'Figurine',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  document_holder: {
    name: 'Document Holder',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  wrench: {
    name: 'Wrench',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  canned_sprats: {
    name: 'Canned Sprats',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  rotary_phone: {
    name: 'Rotary Phone',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  iodine_bottle: {
    name: 'Iodine Solution',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  crystal_decanter: {
    name: 'Decanter',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },

  vinyl_record: {
    name: 'Vinyl Record',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  soviet_watch: {
    name: 'Watch',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  vintage_camera: {
    name: 'Camera',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  fur_shapka: {
    name: 'Shapka',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  condensed_milk: {
    name: 'Condensed Milk',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  soviet_champagne: {
    name: 'Soviet Champagne',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  vodka_bottle: {
    name: 'Vodka Bottle',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  tea_brick: {
    name: 'Tea Brick',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  old_cigarettes: {
    name: 'Cigarettes',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  honey_jar: {
    name: 'Honey Jar',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  pickled_vegetables: {
    name: 'Pickled Vegetables',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  multimeter: {
    name: 'Multimeter',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  hand_drill: {
    name: 'Hand Drill',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  work_gloves: {
    name: 'Work Gloves',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  rubber_boots: {
    name: 'Rubber Boot',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  lab_coat: {
    name: 'Lab Coat',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  protective_goggles: {
    name: 'Protective Goggles',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  geiger_counter: {
    name: 'Geiger Counter',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  gas_mask_gp5: {
    name: 'Gas Mask GP-5',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  chemical_kit: {
    name: 'Chemical Kit',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  soviet_flashlight: {
    name: 'Soviet Flashlight',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  field_phone: {
    name: 'Field Phone',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  signal_flare: {
    name: 'Signal Flare',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  dosimeter: {
    name: 'Dosimeter',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  lucky_coin: {
    name: 'Coin',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  photo_album: {
    name: 'Photo Album',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  foreign_currency: {
    name: 'Banknotes',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  olympic_badge: {
    name: 'Olympic Badge',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  soviet_knife: {
    name: 'Knife',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  mess_kit: {
    name: 'Mess Kit',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  canvas_tent: {
    name: 'Tent',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  sleeping_bag: {
    name: 'Sleeping Bag',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  bandage_tin: {
    name: 'Bandage Tin',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  signal_pistol: {
    name: 'Signal Pistol',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  smoke_grenade: {
    name: 'Smoke Grenade',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  door_handle: {
    name: 'Door Handle',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  window_latch: {
    name: 'Window Latch',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  padlock: {
    name: 'Padlock',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  chain_link: {
    name: 'Chain',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  light_bulb: {
    name: 'Lightbulb',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  fuse_box: {
    name: 'Fuse Box',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  electrical_wire: {
    name: 'Wire',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  insulation_tape: {
    name: 'Tape',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  inventory_keys: {
    name: 'Keys',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  bicycle_pedal: {
    name: 'Bicycle Pedal',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  calipers: {
    name: 'Calipers',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  hammer: {
    name: 'Hammer',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  vase: {
    name: 'Vase',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  handkerchief: {
    name: 'Handkerchief',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  ruined_ammo_box: {
    name: 'Ruined Ammo Box',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  aluminium_bowl: {
    name: 'Aluminium Bowl',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  ruined_ammo_cartridge: {
    name: 'Ruined Ammo Cartridge',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  tin_grain_box: {
    name: 'Tin Box',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  portable_radio: {
    name: 'Portable Radio',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  tabletop_lamp: {
    name: 'Lamp',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  red_rubber_ball: {
    name: 'Red Rubber Ball',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  christmas_ball: {
    name: 'Christmas Ball',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  frying_pan: {
    name: 'Frying Pan',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  ruined_ammunition_7_62: {
    name: 'Ruined Ammunition 7.62',
    volume: 1,
    rarity: 1,
    molecule: blankMolecule,
  },
  // Dev-only single-essence atoms for molecule editor
  dev_atom_red: {
    name: 'Dev Atom (Red)',
    volume: 0,
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
    rarity: 1,
    molecule: {
      atoms: [{ color: 'gray', x: 0, y: 0 }],
      connections: [],
    },
    devOnly: true,
  },
};

// Merge remains with other items
const allDefinitions = {
  ...remainsDefinitions,
  ...rawDefinitions,
};

export const itemDefinitions = processItemDefinitions(allDefinitions);
export default itemDefinitions;
