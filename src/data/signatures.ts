import type { RawSignatureDefinition } from '../logic/SignatureLib';

const signatures: Record<string, RawSignatureDefinition> = {
  s1: {
    name: 'Objectify',
    group: 'starter',
    layout: 'insipre',
    difficulty: 2,
    colors: ['red'],
    rewards: [{ kind: 'refining_yield_pct_bonus', amount: 25 }],
  },
  s2: {
    name: 'Delineate',
    group: 'starter',
    layout: 'up_triangle',
    difficulty: 3,
    colors: ['gray'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 20 },
      { kind: 'refining_speed_pct_bonus', amount: 20 },
      { kind: 'refining_success_chance_bonus', amount: 1 },
    ],
  },
  s3: {
    name: 'Summarize',
    group: 'starter',
    layout: 'sun',
    difficulty: 0,
    colors: ['blue'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 20 },
      { kind: 'refining_speed_pct_bonus', amount: 5 },
    ],
  },
  s4: {
    name: 'Amplify',
    group: 'starter',
    layout: 'h',
    difficulty: 2,
    colors: ['red'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 15 },
      { kind: 'refining_speed_pct_bonus', amount: 15 },
    ],
  },
  s5: {
    name: 'Mesmerize',
    group: 'starter',
    layout: 'up_serpinski',
    difficulty: 0,
    colors: ['blue'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 15 },
      { kind: 'refining_speed_pct_bonus', amount: 10 },
    ],
  },
  s6: {
    name: 'Pulverize',
    group: 'starter',
    layout: 'up_blunt_triangle',
    difficulty: 3,
    colors: ['magenta'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 25 },
      { kind: 'refining_speed_pct_bonus', amount: 25 },
      { kind: 'refining_success_chance_bonus', amount: 5 },
    ],
  },
  s7: {
    name: 'Harmonize',
    group: 'starter',
    layout: 'candy_left',
    difficulty: 2,
    colors: ['green'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 15 },
      { kind: 'refining_speed_pct_bonus', amount: 15 },
      { kind: 'refining_success_chance_bonus', amount: 1 },
    ],
  },
  s8: {
    name: 'Patronize',
    group: 'starter',
    layout: 'shelf_left',
    difficulty: 3,
    colors: ['gray'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 25 },
      { kind: 'refining_success_chance_bonus', amount: 1 },
      { kind: 'refining_speed_pct_bonus', amount: 15 },
    ],
  },


  s9: {
    name: 'Galvanize',
    group: 'starter',
    layout: 'down_trihex',
    difficulty: 1,
    colors: ['blue'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 15 },
      { kind: 'refining_speed_pct_bonus', amount: 15 },
    ],
  },
  s10: {
    name: 'Codify',
    group: 'starter',
    layout: 'down_triangle',
    difficulty: 0,
    colors: ['red'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 25 },
    ],
  },
  s11: {
    name: 'Simplify',
    group: 'starter',
    layout: 'hexagon',
    difficulty: 0,
    colors: ['green'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 25 },
    ],
  },
  s12: {
    name: 'Encapsulate',
    group: 'starter',
    layout: 'ex',
    difficulty: 2,
    colors: ['blue'],
    rewards: [
      { kind: 'refining_speed_pct_bonus', amount: 40 },
    ],
  },
  s13: {
    name: 'Stipulate',
    group: 'starter',
    layout: 'down_serpinski',
    difficulty: 3,
    colors: ['green'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 20 },
      { kind: 'refining_speed_pct_bonus', amount: 5 },
    ],
  },
  s14: {
    name: 'Downgrade',
    group: 'starter',
    layout: 'arrow',
    difficulty: 1,
    colors: ['blue'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 20 },
      { kind: 'refining_speed_pct_bonus', amount: 5 },
    ],
  },
  s15: {
    name: 'Uplift',
    group: 'starter',
    layout: 'candy_right',
    difficulty: 1,
    colors: ['red'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 20 },
      { kind: 'refining_speed_pct_bonus', amount: 5 },
      { kind: 'refining_success_chance_bonus', amount: 1 },
    ],
  },
  s16: {
    name: 'Formulate',
    group: 'starter',
    layout: 'shelf_right',
    difficulty: 3,
    colors: ['yellow'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 15 },
      { kind: 'refining_speed_pct_bonus', amount: 20 },
      { kind: 'refining_success_chance_bonus', amount: 1 },
    ],
  },
};

export default signatures;
