import { OpenSimplex2F } from './openSimplex2F';

// PCG constants for PCG-XSH-RR algorithm (64-bit state, 32-bit output)
const PCG_MULTIPLIER = 6364136223846793005n; // 64-bit multiplier (hex 0x5851F42D4C957F2D)
const PCG_INCREMENT = 1442695040888963407n;  // 64-bit increment (hex 0x14057B7EF767814F)

/**
 * 32-bit right rotation helper function for PCG algorithm
 * @param x 32-bit value to rotate
 * @param r Number of positions to rotate right
 * @returns Rotated 32-bit value
 */
function rotr32(x: number, r: number): number {
  r = r & 31; // Ensure r is in range [0, 31]
  return ((x >>> r) | (x << (32 - r))) >>> 0;
}

/**
 * Converts a 64-bit BigInt state to a 32-bit PCG output using PCG-XSH-RR algorithm
 * @param state 64-bit state as BigInt
 * @returns 32-bit PCG output as regular number
 */
function pcgStateToOutput(state: bigint): number {
  // Ensure 64-bit state parity with C++
  state = state & 0xFFFFFFFFFFFFFFFFn;
  // Extract rotation count from high bits (bits 63-59)
  const count = Number(state >> 59n) & 31;  // Apply XOR-shift: x ^= x >> 18 (18 = (64 - 27)/2)
  let x = state ^ (state >> 18n);  // Extract middle bits (bits 58-27) and apply rotation
  const middle32 = Number((x >> 27n) & 0xFFFFFFFFn);
  return rotr32(middle32, count);
}

/**
 * Advances a seed using Permuted Congruential Generator (PCG) algorithm.
 * Uses 64-bit state internally but accepts/returns regular JavaScript numbers.
 * @param seed The current seed value (will be converted to 64-bit state)
 * @returns The new seed value (converted back from 64-bit state)
 */
export function advanceSeed(seed: number): number {
  // Convert seed to proper 64-bit state
  let state = seedToState(seed);  // Apply PCG state advancement: state = state * multiplier + increment
  state = (state * PCG_MULTIPLIER + PCG_INCREMENT) & 0xFFFFFFFFFFFFFFFFn;  // Convert back to number (using the high 32 bits to avoid loss of entropy)
  return Number(state >> 32n);
}

/**
 * Converts a seed value to a random number between 0 and 1 (exclusive of 1).
 * Uses PCG algorithm for better statistical properties than LCG.
 * @param seed The seed value
 * @returns A number between 0 and 1 (exclusive of 1)
 */
export function seedToRandom(seed: number): number {
  // Convert seed to proper 64-bit state
  const state = seedToState(seed);  // Generate PCG output
  const output = pcgStateToOutput(state);  // Convert 32-bit output to [0, 1) range
  return output / 0x100000000; // Divide by 2^32
}

/**
 * Converts a regular number seed to a proper 64-bit PCG state
 * @param seed Input seed value
 * @returns 64-bit state suitable for PCG algorithm
 */
function seedToState(seed: number): bigint {
  // Use a better mixing function to convert 32-bit-ish seeds to 64-bit states
  // This ensures different seeds produce significantly different states
  const s = BigInt(Math.abs(seed)) & 0xFFFFFFFFn; // Ensure 32-bit range  // Mix the seed to create a 64-bit state with good distribution
  // This is similar to SplitMix64 hash function
  let state = ((s ^ 0x9E3779B97F4A7C15n) * 0xBF58476D1CE4E5B9n) & 0xFFFFFFFFFFFFFFFFn;
  state = ((state ^ (state >> 30n)) * 0x94D049BB133111EBn) & 0xFFFFFFFFFFFFFFFFn;
  state = ((state ^ (state >> 27n)) * 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  return state ^ (state >> 31n);
}

/**
 * Generates a seeded random number and advances the seed using PCG algorithm.
 * @param seed The current seed
 * @returns Object with the random number and new seed
 */
export function seededRandom(seed: number): { value: number; newSeed: number } {
  // Convert seed to proper 64-bit state
  let state = seedToState(seed);  // Generate output from current state
  const output = pcgStateToOutput(state);
  const value = output / 0x100000000; // Convert to [0, 1)  // Advance state for next iteration
  state = (state * PCG_MULTIPLIER + PCG_INCREMENT) & 0xFFFFFFFFFFFFFFFFn;
  const newSeed = Number(state >> 32n);  return { value, newSeed };
}

/**
 * Generates a seeded random integer in the range [min, max] (inclusive).
 * @param seed The current seed
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns Object with the random integer and new seed
 */
export function seededRandomInt(seed: number, min: number, max: number): { value: number; newSeed: number } {
  const { value, newSeed } = seededRandom(seed);
  const range = max - min + 1;
  const randomInt = Math.floor(value * range) + min;
  return { value: randomInt, newSeed };
}

/**
 * Given an array of weights, returns a randomly chosen index based on those weights.
 * @param weights An array of numbers representing the weight of each index.
 * @returns The randomly chosen index, or -1 if the weights array is empty or all weights are zero.
 */
export function getWeightedRandomIndex(weights: number[]): number {
  if (!weights || weights.length === 0) {
    return -1;
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    // If all weights are zero or negative, return a random index with uniform probability,
    // or handle as an error case. For now, returning a random valid index.
    // Alternatively, could return -1 to indicate an issue or a truly random unweighted pick.
    // For now, to avoid issues with empty steps, let's pick uniformly if totalWeight is 0.
    // console.warn("getWeightedRandomIndex: Total weight is zero or negative. Picking uniformly.");
    return 0;
  }

  // Note: This unseeded helper is now deterministic only if caller controls seed.
  // Prefer using getWeightedRandomIndexSeeded.
  let randomValue = totalWeight * 0.5; // fallback deterministic pick: middle of distribution
  for (let i = 0; i < weights.length; i++) {
    if (randomValue < weights[i]) {
      return i;
    }
    randomValue -= weights[i];
  }

  // Should not be reached if totalWeight > 0
  return weights.length - 1; 
}
// General-purpose noise instance
export let generalNoise = new OpenSimplex2F(12345);
/**
 * Seeded weighted index choice. Returns index and advanced seed.
 */
export function getWeightedRandomIndexSeeded(weights: number[], seed: number): { index: number; newSeed: number } {
  if (!weights || weights.length === 0) {
    return { index: -1, newSeed: seed };
  }
  const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (totalWeight <= 0) {
    // deterministic fallback to first
    return { index: 0, newSeed: seed };
  }
  const { value, newSeed } = seededRandom(seed);
  let randomValue = value * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    const w = Math.max(0, weights[i]);
    if (randomValue < w) {
      return { index: i, newSeed };
    }
    randomValue -= w;
  }
  return { index: weights.length - 1, newSeed };
}