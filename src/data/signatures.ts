import type { RawSignatureDefinition } from '../logic/SignatureLib';

const signatures: Record<string, RawSignatureDefinition> = {
  s1: {
    name: 'Objectify',
    group: 'starter',
    layout: 'insipre',
    colors: ['red'],
    rewards: [{ kind: 'refining_yield_pct_bonus', amount: 25 }],
  },
  s2: {
    name: 'Delineate',
    group: 'starter',
    layout: 'up_triangle',
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
    colors: ['red'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 25 },
    ],
  },
  s11: {
    name: 'Simplify',
    group: 'starter',
    layout: 'hexagon',
    colors: ['green'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 25 },
    ],
  },
  s12: {
    name: 'Encapsulate',
    group: 'starter',
    layout: 'ex',
    colors: ['blue'],
    rewards: [
      { kind: 'refining_speed_pct_bonus', amount: 40 },
    ],
  },
  s13: {
    name: 'Stipulate',
    group: 'starter',
    layout: 'down_serpinski',
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
    colors: ['yellow'],
    rewards: [
      { kind: 'refining_yield_pct_bonus', amount: 15 },
      { kind: 'refining_speed_pct_bonus', amount: 20 },
      { kind: 'refining_success_chance_bonus', amount: 1 },
    ],
  },
};

export default signatures;
