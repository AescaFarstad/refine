// OpenSimplex2F noise implementation
// Simplified version providing only X-Before-Y variant and 1D noise
// Adapted from the C reference implementation to TypeScript

// Constants for OpenSimplex2F
const PSIZE = 2048;
const PMASK = 2047;
const N2 = 0.01001634121365712;

// Gradient structures
interface Grad2 {
  dx: number;
  dy: number;
}

// Lattice point structures for OpenSimplex2F
interface LatticePoint2D {
  xsv: number;
  ysv: number;
  dx: number;
  dy: number;
}

// Utility function
function fastFloor(x: number): number {
  const xi = Math.floor(x);
  return x < xi ? xi - 1 : xi;
}

// Create optimized gradients for OpenSimplex2F
function createGradients2D(): Grad2[] {
  const rawGradients = [
    0.130526192220052, 0.99144486137381,
    0.38268343236509, 0.923879532511287,
    0.608761429008721, 0.793353340291235,
    0.793353340291235, 0.608761429008721,
    0.923879532511287, 0.38268343236509,
    0.99144486137381, 0.130526192220051,
    0.99144486137381, -0.130526192220051,
    0.923879532511287, -0.38268343236509,
    0.793353340291235, -0.60876142900872,
    0.608761429008721, -0.793353340291235,
    0.38268343236509, -0.923879532511287,
    0.130526192220052, -0.99144486137381,
    -0.130526192220052, -0.99144486137381,
    -0.38268343236509, -0.923879532511287,
    -0.608761429008721, -0.793353340291235,
    -0.793353340291235, -0.608761429008721,
    -0.923879532511287, -0.38268343236509,
    -0.99144486137381, -0.130526192220052,
    -0.99144486137381, 0.130526192220051,
    -0.923879532511287, 0.38268343236509,
    -0.793353340291235, 0.608761429008721,
    -0.608761429008721, 0.793353340291235,
    -0.38268343236509, 0.923879532511287,
    -0.130526192220052, 0.99144486137381
  ];

  const gradients: Grad2[] = [];
  for (let i = 0; i < rawGradients.length; i += 2) {
    gradients.push({
      dx: rawGradients[i] / N2,
      dy: rawGradients[i + 1] / N2
    });
  }

  const result: Grad2[] = new Array(PSIZE);
  for (let i = 0; i < PSIZE; i++) {
    result[i] = gradients[i % 24];
  }
  return result;
}

// Simplified lookup table for OpenSimplex2F
function createLookup2D(): LatticePoint2D[] {
  return [
    { xsv: 1, ysv: 0, dx: -1 - (-0.211324865405187), dy: 0 - (-0.211324865405187) },
    { xsv: 0, ysv: 0, dx: 0 - (-0.211324865405187), dy: 0 - (-0.211324865405187) },
    { xsv: 1, ysv: 1, dx: -1 - (-0.211324865405187 * 2), dy: -1 - (-0.211324865405187 * 2) },
    { xsv: 0, ysv: 1, dx: 0 - (-0.211324865405187), dy: -1 - (-0.211324865405187) }
  ];
}

class OpenSimplex2F {
  private perm: number[];
  private permGrad2: Grad2[];
  private gradients2D: Grad2[];
  private lookup2D: LatticePoint2D[];

  constructor(seed: number = 0) {
    // Initialize gradients and lookup tables
    this.gradients2D = createGradients2D();
    this.lookup2D = createLookup2D();    // Initialize permutation arrays
    this.perm = new Array(PSIZE);
    this.permGrad2 = new Array(PSIZE);    // Create source array for shuffling
    const source = new Array(PSIZE);
    for (let i = 0; i < PSIZE; i++) {
      source[i] = i;
    }    // Shuffle using seed (matching C implementation)
    let seedValue = seed;
    for (let i = PSIZE - 1; i >= 0; i--) {
      seedValue = seedValue * 6364136223846793005 + 1442695040888963407;
      // Handle JavaScript's 32-bit integer limitation
      seedValue = seedValue & 0xFFFFFFFF;
      let r = Math.abs((seedValue + 31) % (i + 1));      this.perm[i] = source[r];
      this.permGrad2[i] = this.gradients2D[this.perm[i]];      source[r] = source[i];
    }
  }

  private noise2Base(xs: number, ys: number): number {
    let value = 0;

    // Get base points and offsets
    const xsb = fastFloor(xs);
    const ysb = fastFloor(ys);
    const xsi = xs - xsb;
    const ysi = ys - ysb;

    // Index to point list (simplified for OpenSimplex2F)
    const index = Math.floor((ysi - xsi) / 2 + 1);

    const ssi = (xsi + ysi) * -0.211324865405187;
    const xi = xsi + ssi;
    const yi = ysi + ssi;

    // Point contributions (3 points for 2F version)
    for (let i = 0; i < 3; i++) {
      const c = this.lookup2D[(index + i) % 4];
      const dx = xi + c.dx;
      const dy = yi + c.dy;
      let attn = 0.5 - dx * dx - dy * dy;      if (attn <= 0) continue;

      const pxm = (xsb + c.xsv) & PMASK;
      const pym = (ysb + c.ysv) & PMASK;
      const grad = this.permGrad2[this.perm[pxm] ^ pym];
      const extrapolation = grad.dx * dx + grad.dy * dy;

      attn *= attn;
      value += attn * attn * extrapolation;
    }

    return value;
  }

  /**
   * 2D OpenSimplex2F noise, with Y pointing down the main diagonal.
   * Better for 2D sandbox style games where Y is vertical.
   */
  noise2DXBeforeY(x: number, y: number): number {
    // Scale coordinates by 0.01 for more reasonable input values
    x *= 0.01;
    y *= 0.01;    // Skew transform and rotation baked into one
    const xx = x * 0.7071067811865476;
    const yy = y * 1.224744871380249;
    return this.noise2Base(yy + xx, yy - xx);
  }

  /**
   * 1D OpenSimplex2F noise using the X-Before-Y variant with y=0.
   */
  noise1D(x: number): number {
    return this.noise2DXBeforeY(x, 0);
  }
}

// Global OpenSimplex2F noise instance
let globalOpenSimplex2F: OpenSimplex2F | null = null;

/**
 * Initialize or reinitialize the global OpenSimplex2F noise generator with a seed.
 * @param seed Seed for reproducible noise.
 */
export function initOpenSimplex2F(seed: number = 0): void {
  globalOpenSimplex2F = new OpenSimplex2F(seed);
}

/**
 * Generate 1D OpenSimplex2F noise value using the global noise generator.
 * @param x The x coordinate.
 * @returns A noise value between approximately -1 and 1.
 */
export function openSimplex1D(x: number): number {
  if (!globalOpenSimplex2F) {
    initOpenSimplex2F();
  }
  return globalOpenSimplex2F!.noise1D(x);
}

/**
 * Generate 2D OpenSimplex2F noise value using the global noise generator (X-Before-Y variant).
 * @param x The x coordinate.
 * @param y The y coordinate.
 * @returns A noise value between approximately -1 and 1.
 */
export function openSimplex2DXBeforeY(x: number, y: number): number {
  if (!globalOpenSimplex2F) {
    initOpenSimplex2F();
  }
  return globalOpenSimplex2F!.noise2DXBeforeY(x, y);
}

/**
 * Generate octave OpenSimplex2F 1D noise by combining multiple frequencies.
 * @param x The x coordinate.
 * @param octaves Number of octaves (layers) to combine.
 * @param persistence How much each octave contributes relative to the previous.
 * @param scale The scale/frequency of the base noise.
 * @returns A noise value.
 */
export function octaveOpenSimplex1D(
  x: number, 
  octaves: number = 4, 
  persistence: number = 0.5, 
  scale: number = 1
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += openSimplex1D(x * frequency) * amplitude;    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue;
}

/**
 * Generate octave OpenSimplex2F 2D noise by combining multiple frequencies (X-Before-Y variant).
 * @param x The x coordinate.
 * @param y The y coordinate.
 * @param octaves Number of octaves (layers) to combine.
 * @param persistence How much each octave contributes relative to the previous.
 * @param scale The scale/frequency of the base noise.
 * @returns A noise value.
 */
export function octaveOpenSimplex2DXBeforeY(
  x: number, 
  y: number, 
  octaves: number = 4, 
  persistence: number = 0.5, 
  scale: number = 1
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += openSimplex2DXBeforeY(x * frequency, y * frequency) * amplitude;    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue;
}

// Export the OpenSimplex2F class for direct use if needed
export { OpenSimplex2F }; 