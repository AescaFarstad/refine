import type { RawGearDefinition } from '../logic/GearLib';

// Gear definitions (raw). Keys are IDs; values omit implicit 'id' field (auto-injected by Lib).
const gear: Record<string, RawGearDefinition> = {
  // ── Melee Weapons ──────────────────────────────────────────────────
  brass_knuckles: {
    name: 'Brass Knuckles',
    category: 'melee_weapons',
    damage: 1,
    chanceToHit: 10,
    price: 20,
    weight: 1,
    image: 'knuckles',
    xp: [12, 24],
    ups:{
      up1:{
        price: 30,
        chanceToHit: 10,
        title:'Fine-tuned grip'
      },
      up2:{ 
        skillPoints: 1,
        title:'Pratice!' 
      },
      up3:{
        price: 10,
        weight: -1,
        title:'Carbon alloy'
      }
    }
  },
  machete: {
    name: 'Kukri',
    category: 'melee_weapons',
    damage: 2,
    chanceToHit: 10,
    rarityBuff: -20,
    price: 40,
    weight: 2,
    image: 'kukri',
    perk: 'Hack and Slash',
    description: 'Scavenging takes 2 minutes less',
    xp: [16, 18],
    ups:{
      up1:{
        skillPoints: 0,
        removePerk: true,
        rarityBuff: 20,
        changeDescription:'',
        title:'Excersize care'
      },
      up2:{ 
        skillPoints: 1,
        title:'Pratice!' 
      },
      up3:{
        skillPoints: 0,
        chanceToHit: -10,
        weight: -1,
        title:'Shorter handle'
      }
    },
  },
  fire_axe: {
    name: 'Fire Axe',
    category: 'melee_weapons',
    damage: 4,
    rarityBuff: -20,
    price: 110,
    weight: 3,
    image: 'axe',
    perk: 'Hack and Crack',
    description: 'Scavenging takes 4 minutes less',
  },
  sledgehammer: {
    name: 'Sledgehammer',
    category: 'melee_weapons',
    damage: 2,
    chanceToBlock: 15,
    price: 50,
    weight: 4,
    image: 'sledgehammer',
    perk: 'Armor Crushing',
    description: 'Halves enemy\'s armor value',
    xp: [8, 12],
    ups:{
      up1:{
        skillPoints: 0,
        damage: 1,
        weight: 1,
        title:'Thick Head'
      },
      up2:{ 
        chanceToBlock: 5,
        weight: -1,
        title:'Custom handle' 
      },
      up3:{
        replacePerk: "Armor Tearing",
        changeDescription:'Each hit tears 1 armor',
        title:'Piercing Head'
      }
    },
  },
  walking_stick: {
    name: 'Walking Stick',
    category: 'melee_weapons',
    damage: 1,
    speedFlat: 1,
    speedPercent: 20,
    price: 60,
    weight: 1,
    image: 'walking_stick',
    xp: [8, 12],
    ups:{
      up1:{
        skillPoints: 0,
        damage: -1,
        weight: -1,
        price: -20,
        title:'Plastic core'
      },
      up2:{ 
        skillPoints: 0,
        speedPercent: 10,
        title:'Well-adjusted' 
      },
      up3:{
        skillPoints: 1,
        speedFlat: 1,
        price: 20,
        title:'Spring system' 
      }
    },
  },
  stun_baton: {
    name: 'Stun Gun',
    category: 'melee_weapons',
    stunChance: 40,
    price: 250,
    weight: 2,
    image: 'stun_gun',
    description: 'Stunned enemies skip one turn',
  },
  riot_shield: {
    name: 'Riot Shield',
    category: 'melee_weapons',
    chanceToBlock: 40,
    chanceToHit: -20,
    attackSkipCount: 2,
    price: 300,
    weight: 8,
    image: 'police_shield',
    description: 'Negates 2 successful enemy hits in each fight',
  },

  // ── Ranged Weapons ─────────────────────────────────────────────────
  nail_gun: {
    name: 'Flare Gun',
    category: 'ranged_weapons',
    damage: 1,
    stunChance: 20,
    price: 50,
    weight: 2,
    image: 'flare_gun',
    description: 'Stunned enemies skip one turn',
  },
  revolver: {
    name: 'Revolver',
    category: 'ranged_weapons',
    damage: 2,
    chanceToHit: 15,
    price: 90,
    weight: 2,
    image: 'revolver2',
    perk: 'Aiming',
    description: 'Attacks take 1 minute longer',
    xp: [12, 24],
    ups:{
      up1:{
        damage: 1,
        price: 10,
        title:'Polished barrel'
      },
      up2:{ 
        skillPoints: 1,
        title:'Pratice!' 
      },
      up3:{
        skillPoints: 1,
        chanceToHit: -5,
        replacePerk: "Fan the Hammer",
        changeDescription:'Contributes double damage on odd rounds, no damage on even ones',
        title:'Fan the Hammer' 
      }
    },
  },
  uzi: {
    name: 'Uzi',
    category: 'ranged_weapons',
    damage: 4,
    price: 110,
    weight: 3,
    image: 'uzi2',
    xp: [8, 14],
    ups:{
      up1:{
        damage: 1,
        chanceToHit: -10,
        replacePerk: "Spray and Pray",
        changeDescription:'Attacks take 1 minute less',
        title:'Spray and Pray'
      },
      up2:{ 
        skillPoints: 1,
        title:'Pratice!' 
      },
      up3:{
        damage: -1,
        weight: -1,
        price: -40,
        title:'Simplified model'
      }
    },
  },
  shotgun: {
    name: 'Shotgun',
    category: 'ranged_weapons',
    damage: 2,
    chanceToHit: 35,
    price: 200,
    weight: 4,
    image: 'shotgun',
  },
  ak_rifle: {
    name: 'Assault Rifle',
    category: 'ranged_weapons',
    damage: 7,
    price: 300,
    weight: 4,
    image: 'ak_rifle',
    xp: [8, 16],
    ups:{
      up1:{
        skillPoints: -1,
        damage: 2,
        weight: 1,
        price: 50,
        title:'Milled Receiver'
      },
      up2:{ 
        skillPoints: -1,
        damage: 2,
        price: 100,
        title:'Tungsten Ammo'
      },
      up3:{
        skillPoints: -1,
        damage: 2,
        chanceToHit: -10,
        price: 50,
        title:'Large Gas Port'
      }
    },
  },
  m4_rifle: {
    name: 'Spec Ops Rifle',
    category: 'ranged_weapons',
    damage: 4,
    chanceToHit: 25,
    price: 350,
    weight: 4,
    image: 'm4_rifle',
    perk: 'Aiming',
    description: 'Attacks take 1 minute longer',
  },
  sniper_rifle: {
    name: 'Sniper Rifle',
    category: 'ranged_weapons',
    damage: 5,
    chanceToHit: 50,
    price: 450,
    weight: 5,
    image: 'sniper_rifle',
    perk: 'Aiming',
    description: 'Attacks take 1 minute longer',
  },

  // ── Accessories ────────────────────────────────────────────────────
  boots_basic: {
    name: 'Light Boots',
    category: 'accessories',
    speedPercent: 50,
    price: 30,
    weight: 0,
    image: 'trainers',
    xp: [8, 16],
    ups:{
      up1:{
        skillPoints: -1,
        price: 20,
        speedPercent: 25,
        title:'Aeroweave Mesh'
      },
      up2:{ 
        skillPoints: 1,
        title:'Pratice!' 
      },
      up3:{
        skillPoints: 0,
        price: -10,
        title:'Streamlined'
      }
    },
  },
  sprint_boots: {
    name: 'Spring Boots',
    category: 'accessories',
    speedFlat: 2,
    maxWeight: 4,
    price: 75,
    weight: 1,
    image: 'spring_boots2',
    xp: [8, 12],
    ups:{
      up1:{
        skillPoints: -1,
        weight: 1,
        speedFlat: 1,
        title:'Dual-Spring'
      },
      up2:{ 
        skillPoints: -1,
        maxWeight: 4,
        price: 15,
        title:'Support Harness' 
      },
      up3:{
        skillPoints: -1,
        price: -20,
        title:'Riveted Assembly'
      }
    },
  },
  oxygen_mask: {
    name: 'Oxygen Mask',
    category: 'accessories',
    hp: 7,
    price: 40,
    speedPercent: 20,
    weight: 1,
    image: 'gas_mask',
    xp: [8, 12],
    ups:{
      up1:{
        skillPoints: -1,
        weight: -1,
        title:'Closed-Cycle'
      },
      up2:{ 
        skillPoints: 1,
        title:'Pratice!' 
      },
      up3:{
        skillPoints: -1,
        weight: 1,
        hp: 7,
        price: 20,
        title:'Ionizing Filter'
      }
    },
  },
  scope: {
    name: 'Scope',
    category: 'accessories',
    chanceToHit: 15,
    price: 100,
    weight: 1,
    image: 'scope',
    perk: 'Aiming',
    description: 'Attacks take 1 minute longer',
  },
  scout_binoculars: {
    name: 'Binoculars',
    category: 'accessories',
    lootChance: 15,
    rarityBuff: 15,
    price: 80,
    weight: 1,
    image: 'binoculars',
    xp: [8, 12],
    ups:{
      up1:{
        skillPoints: -1,
        lootChance: 15,
        price: 20,
        title:'Anti-Glare'
      },
      up2:{ 
        skillPoints: -1,
        rarityBuff: 15,
        price: 20,
        title:'Infrared Filter' 
      },
      up3:{
        skillPoints: -1,
        chanceToHit: 10,
        title:'Rangefindery'
      }
    },
  },
  laser_sight: {
    name: 'Laser Sight',
    category: 'accessories',
    chanceToHit: 20,
    price: 250,
    weight: 1,
    image: 'laser_sight',
  },
  combat_stims: {
    name: 'Combat Stims',
    category: 'accessories',
    hp: 5,
    chanceToHit: 25,
    speedPercent: 50,
    regenAfterCombat: -2,
    regenPerKm: -1,
    price: 90,
    weight: 0,
    image: 'pack_of_syringes',
    xp: [5, 15],
    ups:{
      up1:{
        skillPoints: 0,
        hp: 10,
        regenPerKm: -1,
        title:'Cortisol Injection'
      },
      up2:{ 
        skillPoints: 0,
        speedPercent: 50,
        regenAfterCombat: -1,
        title:'Epinephrine Injection' 
      },
      up3:{
        skillPoints: 0,
        price: -70,
        hp: -5,
        title:'Synthetic Fillers'
      }
    },
  },

  // ── Armor ──────────────────────────────────────────────────────────
  padded_jacket: {
    name: 'Jacket',
    category: 'armor',
    volume: 5,
    hp: 5,
    price: 30,
    weight: 1,
    image: 'padded_jacket',
    xp: [12, 24],
    ups:{
      up1:{
        skillPoints: -1,
        volume: 10,
        weight: 1,
        price: 20,
        title:'Webbing Grid'
      },
      up2:{ 
        skillPoints: -1,
        hp: 5,
        price: 20,
        title:'Gel Padding' 
      },
      up3:{
        skillPoints: -1,
        chanceToBlock: 10,
        weight: 1,
        title:'Ballistic Inserts'
      }
    },
  },
  kevlar_helmet: {
    name: 'Kevlar Helmet',
    category: 'armor',
    chanceToBlock: 20,
    hp: 3,
    price: 80,
    weight: 2,
    image: 'helmet',
    xp: [10, 16],
    ups:{
      up1:{
        skillPoints: -1,
        weight: -1,
        title:'Carbon Fiber Shell'
      },
      up2:{ 
        skillPoints: -1,
        hp: 5,
        title:'Shock-Absorbers' 
      },
      up3:{
        skillPoints: -1,
        price: -40,
        title:'Injection-Molding'
      }
    },
  },
  armor_plates: {
    name: 'Armor Plates',
    category: 'armor',
    chanceToBlock: 20,
    armor: 1,
    price: 120,
    weight: 4,
    image: 'armor_plates3',
  },
  tactical_visor: {
    name: 'Tactical Visor',
    category: 'armor',
    chanceToHit: 10,
    chanceToBlock: 10,
    price: 150,
    weight: 1,
    image: 'visor',
  },
  kevlar_vest: {
    name: 'Kevlar Vest',
    category: 'armor',
    hp: 14,
    volume: 5,
    price: 100,
    weight: 3,
    image: 'vest',
  },
  camouflage_cloak: {
    name: 'Camo Cloak',
    category: 'armor',
    hp: 8,
    price: 120,
    weight: 1,
    speedPercent: 30,
    image: 'camo_cloak',
    perk: 'Camouflage',
    description: '10% chance to skip a fight encounter',
  },
  spiked_armor: {
    name: 'Spiked Armor',
    category: 'armor',
    reflectOnBlockPct: 100,
    chanceToBlock: 10,
    price: 300,
    weight: 6,
    armor: 1,
    image: 'spiked_armor',
    description: 'Damage blocked is dealt to the enemy',
  },

  // ── Bags ───────────────────────────────────────────────────────────
  pouches: {
    name: 'Tactical Pouches',
    category: 'bags',
    volume: 10,
    price: 40,
    weight: 1,
    image: 'pouches',
  },
  backpack: {
    name: 'Backpack',
    category: 'bags',
    volume: 18,
    price: 60,
    weight: 2,
    image: 'backpack',
    xp: [12, 18],
    ups:{
      up1:{
        skillPoints: -1,
        weight: -1,
        title:'Ripstop Nylon'
      },
      up2:{ 
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: -1,
        replacePerk: "Hanoi Packing",
        changeDescription: '+2 volume per gear item with volume',
        title:'Injection-Molding'
      }
    },
  },
  rucksack: {
    name: 'Rucksack',
    category: 'bags',
    volume: 25,
    price: 120,
    maxWeight: 5,
    weight: 2,
    image: 'rucksack',
    xp: [8, 14],
    ups:{
      up1:{
        skillPoints: -1,
        maxWeight: 5,
        weight: 1,
        title:'Steel Frame'
      },
      up2:{ 
        skillPoints: -1,
        volume: 10,
        price: 30,
        title:'Roll-Top Extension' 
      },
      up3:{
        skillPoints: -1,
        replacePerk: "Tetris Legacy",
        changeDescription: 'Looted items take up 1 less volume (min 1)',
        title:'Tetris Legacy'
      }
    },
  },
  reinforced_case: {
    name: 'Reinforced Case',
    category: 'bags',
    volume: 12,
    chanceToBlock: 15,
    price: 180,
    weight: 4,
    image: 'reinforced_case',
  },
  cargo_harness: {
    name: 'Cargo Harness',
    category: 'bags',
    volume: 20,
    maxWeight: 10,
    price: 180,
    weight: 3,
    image: 'cargo_harness',
  },
  cargo_trolley: {
    name: 'Cargo Trolley',
    category: 'bags',
    volume: 45,
    maxWeight: 20,
    speedPercent: -20,
    price: 300,
    weight: 8,
    image: 'cargo_trolley',
  },
  scaffold: {
    name: 'Scaffold',
    category: 'bags',
    countable: true,
    weight: 8,
    raidResourceStorageBonus: 500,
    image: 'scaffold',
  },

  // ── Devices ────────────────────────────────────────────────────────
  bone_saw: {
    name: 'Bone Saw',
    category: 'devices',
    price: 30,
    weight: 1,
    image: 'bone_saw',
    biopsyChance: 20,
    description: 'Allows extracting monster remains',
    xp: [18, 24],
    ups:{
      up1:{
        skillPoints: -1,
        weight: 2,
        biopsyChance: 10,
        title:'Raker Teeth'
      },
      up2:{ 
        skillPoints: -1,
        damage: 1,
        price: 30,
        title:'Carbide Teeth'
      },
      up3:{
        skillPoints: -1,
        biopsyChance: 10,
        regenAfterCombat: -2,
        title:'Blood Channel'
      }
    },
  },
  aspirator_probe: {
    name: 'Aspirator Probe',
    category: 'devices',
    price: 100,
    weight: 1,
    image: 'aspirator_probe',
    biopsyChance: 30,
    description: 'Allows extracting monster remains',
  },
  field_scanner: {
    name: 'Field Scanner',
    category: 'devices',
    chanceToHit: 10,
    lootChance: 10,
    speedPercent: 25,
    price: 160,
    weight: 1,
    image: 'field_scanner',
  },
  metal_detector: {
    name: 'Metal Detector',
    category: 'devices',
    lootChance: 15,
    rarityBuff: 10,
    price: 100,
    weight: 1,
    image: 'mine_sweeper',
    xp: [10, 16],
    ups:{
      up1:{
        skillPoints: 0,
        weight: 1,
        rarityBuff: 20,
        title:'Oversize Dish'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: -1,
        lootChance: 15,
        title:'Spectrum Filter'
      }
    },
  },
  distress_beacon: {
    name: 'Distress Beacon',
    category: 'devices',
    price: 180,
    weight: 2,
    reimbursed: 40,
    image: 'collar',
    description: 'Part of the equipment cost is reimbursed in case you die in the raid',
  },
  biofoam: {
    name: 'Biofoam Dispenser',
    category: 'devices',
    regenAfterCombat: 2,
    price: 230,
    weight: 3,
    image: 'foam_dispenser',
  },
  stabilizer_beacon: {
    name: 'Stabilizer Beacon',
    category: 'devices',
    price: 250,
    priceChange: 100,
    weight: 5,
    image: 'beckon',
    zoneBoost: 30 * 60,
  },

  // ── Companions ─────────────────────────────────────────────────────
  decoy: {
    name: 'Decoy',
    category: 'companions',
    price: 50,
    weight: 3,
    attackSkipCount: 2,
    image: 'decoy',
    description: 'Negates 2 successful enemy hits in each fight',
    xp: [16, 20],
    ups:{
      up1:{
        skillPoints: -1,
        attackSkipCount: 1,
        changeDescription: 'Negates 3 successful enemy hits in each fight',
        title:'Onion packing'
      },
      up2:{ 
        skillPoints: -1,
        weight: -1,
        title:'Hollow Knight'
      },
      up3:{
        skillPoints: 0,
        price: -30,
        title:'Recycled parts'
      }
    },
  },
  combat_drone: {
    name: 'Combat Drone',
    category: 'companions',
    damage: 1,
    price: 80,
    weight: 0,
    image: 'fighter_drone',
    xp: [12, 18],
    ups:{
      up1:{
        skillPoints: -1,
        damage: 1,
        price: 40,
        title:'Dual-Axis Gimbal'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: -1,
        replacePerk: "Delivery Service",
        changeDescription: 'Grenades don\'t contribute weight',
        title:'Grenade mounts'
      }
    },
  },
  cargo_drone: {
    name: 'Cargo Drone',
    category: 'companions',
    maxWeight: 15,
    volume: 15,
    reimbursed: 15,
    price: 150,
    weight: 0,
    image: 'cargo_drone',
  },
  recon_drone: {
    name: 'Recon Drone',
    category: 'companions',
    lootChance: 15,
    chanceToHit: 15,
    price: 150,
    weight: 0,
    image: 'reckon_drone',
  },
  quad_bike: {
    name: 'Quad Bike',
    category: 'companions',
    price: 250,
    weight: 0,
    speedFlat: 10,
    maxWeight: 10,
    image: 'quad_bike',
  },
  robodog: {
    name: 'Robodog',
    category: 'companions',
    maxWeight: 20,
    volume: 24,
    reimbursed: 20,
    price: 300,
    weight: 0,
    image: 'robodog',
    description: 'Part of the equipment cost is reimbursed in case you die in the raid',
  },
  tesseract: {
    name: 'Tesseract',
    category: 'companions',
    countable: true,
    weight: 12,
    raidPassiveCreditsPerHour: 10,
    image: 'tesseract',
    description: 'Collect these resources with the corresponding tactic',
  },

  // ── Grenades ───────────────────────────────────────────────────────
  flash_grenade: {
    name: 'Flash Grenade',
    category: 'grenades',
    chanceToHit: 10,
    stunChance: 10,
    price: 60,
    weight: 1,
    image: 'flashbang',
    xp: [8, 16],
    ups:{
      up1:{
        skillPoints: -1,
        attackSkipCount: 1,
        changeDescription: 'Negates 1 successful enemy hits in each fight',
        title:'Glass Capsule'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: -1,
        stunChance: 10,
        title:'Magnesium Core'
      }
    },
  },
  frag_grenade: {
    name: 'Frag Grenade',
    category: 'grenades',
    damage: 2,
    price: 90,
    weight: 1,
    image: 'frag_grenade2',
    perk: 'Explosive',
    description: '40% chance to spoil the monster remains',
    xp: [8, 12],
    ups:{
      up1:{
        skillPoints: -1,
        damage: 1,
        price: 20,
        title:'Octol Charge'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: 0,
        price: -40,
        title:'Cast Iron Casing'
      }
    },
  },
  smoke_grenade: {
    name: 'Smoke Grenade',
    category: 'grenades',
    chanceToBlock: 20,
    chanceToHit: -10,
    price: 120,
    weight: 1,
    image: 'smoke_grenade',
  },
  xeno_bait: {
    name: 'Xeno Bait',
    category: 'grenades',
    countable:true,
    weight: 1,
    image: 'bait',
    perk: 'Xeno hound Bait',
    description: 'Permanently attracts a xeno hound to the raid',
  },
  fractal: {
    name: 'Fractal',
    category: 'grenades',
    countable: true,
    weight: 1,
    image: 'bismuth',
    perk: 'Materialization',
    description: 'At the start of the raid, choose one item guaranteed to be looted',
  },
  zone_crystal: {
    name: 'Zone Crystal',
    category: 'grenades',
    countable:true,
    weight: 1,
    image: 'quartz',
    zoneBoost: 10 * 60,
    xp: [5, 7],
    ups:{
      up1:{
        skillPoints: 0,
        zoneBoost: 10 * 60,
        title:'Supercharged'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: 0,
        weight: -1,
        title:'Cleaned'
      }
    },
  },
  spice: {
    name: 'Spice',
    category: 'grenades',
    countable: true,
    weight: 0,
    image: 'salt',
    perk: 'Time dilation',
    preventsSuccessZoneDeterioration: true,
    description: 'The zone does not deteriorate after a successful raid.',
  },

  // ── Medicine ───────────────────────────────────────────────────────
  painkillers: {
    name: 'Painkillers',
    category: 'medicine',
    hp: 6,
    price: 60,
    weight: 0,
    perk: 'Painkiller',
    image: 'syringe',
    description: 'Prevents speed loss due to missing health',
    xp: [16, 24],
    ups:{
      up1:{
        skillPoints: -1,
        hp: 6,
        title:'Marrow Catalyst'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: -1,
        regenPerKm: 1,
        title:'Extended Half-Life'
      }
    },
  },
  bandage: {
    name: 'Bandage',
    category: 'medicine',
    regenAfterCombat: 1,
    price: 30,
    weight: 1,
    image: 'bandage',
    xp: [16, 24],
    ups:{
      up1:{
        skillPoints: -1,
        attackSkipCount: 1,
        changeDescription: 'Negates 1 successful enemy hit in each fight',
        title:'Chitin-Fiber Dressing'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: -1,
        regenPerKm: 1,
        title:'Collagen Matrix'
      }
    },
  },
  stim_patch: {
    name: 'Stim Patch',
    category: 'medicine',
    regenPerKm: 3,
    price: 90,
    weight: 0,
    image: 'stim_patch',
    xp: [10, 16],
    ups:{
      up1:{
        skillPoints: 0,
        regenPerKm: 1,
        title:'Platelet Infusion'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: 0,
        price: -40,
        title:'Homemade adhesive'
      }
    },
  },
  medkit_basic: {
    name: 'Medkit',
    category: 'medicine',
    hpMult: 2,
    price: 180,
    weight: 2,
    image: 'ambulance_case',
    xp: [12, 18],
    ups:{
      up1:{
        skillPoints: -1,
        hpMult: 0.5,
        weight: 1,
        title:'Tissue Library'
      },
      up2:{
        skillPoints: 1,
        title:'Pratice!'
      },
      up3:{
        skillPoints: 0,
        price: -80,
        title:'Break-To-Open Housing'
      }
    },
  },
  plasma_bag: {
    name: 'Plasma Bag',
    category: 'medicine',
    regenPer10Minutes: 1,
    price: 150,
    weight: 1,
    image: 'plasma_bag',
  },
  surgical_stapler: {
    name: 'Surgical Stapler',
    category: 'medicine',
    regenAfterCombat: 1,
    regenPerKm: 1,
    price: 150,
    weight: 2,
    image: 'stapler',
  },
  trauma_kit: {
    name: 'Trauma Kit',
    category: 'medicine',
    hp: 12,
    regenPerKm: 2,
    price: 200,
    weight: 2,
    image: 'trauma_kit',
    xp: [8, 12],
    ups:{
      up1:{
        skillPoints: -1,
        hp: 12,
        weight: 1,
        title:'Exoskeletal Support Rig'
      },
      up2:{
        skillPoints: -1,
        regenPerKm: 3,
        weight: 1,
        title:'Dialysis Module'
      },
      up3:{
        skillPoints: 0,
        price: -80,
        title:'Minimum Spec'
      }
    },
  },

  // ── Tactics ────────────────────────────────────────────────────────
  thorough_search: {
    name: 'Thorough Search',
    category: 'tactics',
    perk: 'Thorough Search',
    lootChance: 10,
    rarityBuff: 25,
    price: 0,
    weight: 0,
    image: 'thorough_search',
    description: 'Scavenging takes 5 minutes more',
  },
  firearms_checkup: {
    name: 'Firearms Check-up',
    category: 'tactics',
    perk: 'Firearms Check-up',
    prepTimeMin: 30,
    bonusDamagePerCategory: { ranged_weapons: 1 },
    price: 0,
    weight: 0,
    image: 'firearms_maintenance',
    description: 'Firearms damage +1',
  },
  preapply_medicine: {
    name: 'Pre-apply Medicine',
    category: 'tactics',
    perk: 'Pre-apply Medicine',
    prepTimeMin: 30,
    bonusHpPerCategory: { medicine: 3 },
    price: 0,
    weight: 0,
    image: 'preapply_medicine',
    description: '+3 health per medicine item equipped',
  },
  adjust_armor: {
    name: 'Adjust Armor',
    category: 'tactics',
    perk: 'Adjust Armor',
    prepTimeMin: 30,
    bonusBlockChancePerCategory: { armor: 5 },
    bonusHpPerCategory: { armor: 2 },
    price: 0,
    weight: 0,
    image: 'armor_straps',
    description: '+5% block chance, +2 health per armor item equipped',
  },
  safer_routes: {
    name: 'Safer Routes',
    category: 'tactics',
    perk: 'Safer Routes',
    walkMultiplier: 2,
    price: 0,
    weight: 0,
    image: 'safe_routes',
    description: 'Skip the first enemy after walking',
  },
  no_scavenging: {
    name: 'No Scavenging',
    category: 'tactics',
    perk: 'No Scavenging',
    walkDelta: -1,
    ignoreLootEncounters: true,
    price: 0,
    weight: 0,
    image: 'no_scavenging',
    description: 'Skip all scavenging sites, thus saving time',
  },
  gather_resources: {
    name: 'Collect Resources',
    category: 'tactics',
    gatherRaidResources: true,
    price: 0,
    weight: 0,
    image: 'crates_3d',
    description: 'Visit the placed tesseracts and collect accumulated resources',
  },

  // ── Summons (commented out) ────────────────────────────────────────
  /*
  summon_slimy_mound: {
    name: 'Summon Slimy Mound',
    category: 'summons',
    damage: 1,
    price: 150,
    image: 'smoke_grenade',
  },
  summon_wisp: {
    name: 'Summon Wisp',
    category: 'summons',
    regenPerKm: 1,
    price: 150,
    image: 'smoke_grenade',
  },
  summon_blinding_spectre: {
    name: 'Summon Blinding Spectre',
    category: 'summons',
    chanceToBlock: 10,
    price: 150,
    image: 'smoke_grenade',
  },
  summon_dimensional_fracture: {
    name: 'Create Dimensional Fracture',
    category: 'summons',
    speedFlat: 1,
    price: 150,
    image: 'smoke_grenade',
  },
  summon_jackal: {
    name: 'Summon Jackal',
    category: 'summons',
    lootChance: 10,
    price: 150,
    image: 'smoke_grenade',
  },
  */

  // ── Hidden ─────────────────────────────────────────────────────────
  overweight: {
    name: 'Overweight',
    category: 'hidden',
    chanceToHit: -10,
    chanceToBlock: -10,
    speedFlat: -1,
    price: 0,
    weight: 0,
  },
};

export default gear;
