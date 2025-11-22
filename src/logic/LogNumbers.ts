
const INITIAL_BUFFER_SIZE = 100 * 1024; // 100k uint16s
const INITIAL_INDEX_SIZE = 5000; // Support up to N=5000 initially

let dataBuffer = new Uint16Array(INITIAL_BUFFER_SIZE);
let startIndices = new Uint32Array(INITIAL_INDEX_SIZE);
let maxCalculated = 0;
let dataCursor = 0;

function ensureBufferCapacity(needed: number) {
  if (dataCursor + needed > dataBuffer.length) {
    const newSize = Math.max(dataBuffer.length * 2, dataCursor + needed + 1024);
    const newBuffer = new Uint16Array(newSize);
    newBuffer.set(dataBuffer);
    dataBuffer = newBuffer;
  }
}

function ensureIndexCapacity(n: number) {
  if (n + 2 > startIndices.length) {
    const newSize = Math.max(startIndices.length * 2, n + 1024);
    const newIndices = new Uint32Array(newSize);
    newIndices.set(startIndices);
    startIndices = newIndices;
  }
}

function init() {
  // Representation for 0 is empty
  startIndices[0] = 0;
  startIndices[1] = 0;

  // Representation for 1 is [1]
  ensureBufferCapacity(1);
  dataBuffer[0] = 1;
  dataCursor = 1;
  startIndices[2] = 1;

  maxCalculated = 1;
}

export function getRepresentation(n: number): Uint16Array {
  if (maxCalculated === 0) {
    init();
  }

  if (n > maxCalculated) {
    calculateUpTo(n);
  }

  const start = startIndices[n];
  const end = startIndices[n + 1];
  return dataBuffer.subarray(start, end);
}

function calculateUpTo(targetN: number) {
  ensureIndexCapacity(targetN);

  for (let N = maxCalculated; N < targetN; N++) {
    const nextTarget = N + 1;

    // Get previous representation (N)
    const prevStart = startIndices[N];
    const prevEnd = startIndices[N + 1];
    const prevLen = prevEnd - prevStart;
    // maxUsed is simply the length of the representation array
    // because we trim trailing zeros (implicitly, by not adding them)
    // and the array represents counts of 1, 2, 3...
    const maxUsed = prevLen;

    let found = false;

    // Check k from maxUsed + 1 down to 2
    for (let k = maxUsed + 1; k >= 2; k--) {
      const remainder = nextTarget - k;
      // remainder >= 0 is guaranteed since k <= nextTarget (if k > nextTarget, remainder < 0)
      // But k starts at maxUsed + 1. maxUsed for N is small. k is small.
      // If nextTarget is small (e.g. 2), k starts at 2. remainder = 0.
      // getRepresentation(0) returns empty array.

      // We can access indices directly since remainder < nextTarget <= N+1
      // and we have calculated up to N.
      const baseStart = startIndices[remainder];
      const baseEnd = startIndices[remainder + 1];
      // We need to read values from baseRep.
      // baseRep[i] corresponds to count of number (i+1).

      // Check condition: f(k-1) / (f(k) + 1) >= k / (k-1)
      // f(x) is at index x-1.

      // Get f(k-1) -> index k-2
      const idxKMinus1 = k - 2;
      const countKMinus1 = (baseStart + idxKMinus1 < baseEnd) ? dataBuffer[baseStart + idxKMinus1] : 0;

      // Get f(k) -> index k-1
      const idxK = k - 1;
      const countK = (baseStart + idxK < baseEnd) ? dataBuffer[baseStart + idxK] : 0;

      const lhs = countKMinus1 / (countK + 1);
      const rhs = k / (k - 1);

      if (lhs >= rhs) {
        // Found valid k
        // New representation is baseRep + one k
        // Length will be max(baseLen, k)
        const baseLen = baseEnd - baseStart;
        const newLen = Math.max(baseLen, k);

        ensureBufferCapacity(newLen);

        // Copy baseRep
        if (baseLen > 0) {
          // dataBuffer.copyWithin? No, we are copying FROM dataBuffer TO dataBuffer (different location)
          // subarray + set is easiest
          dataBuffer.set(dataBuffer.subarray(baseStart, baseEnd), dataCursor);
        }

        // Fill zeros if needed (between baseLen and k)
        // Typed array is initialized to 0? No, we are reusing buffer.
        // We must clear the gap if we are skipping.
        if (k > baseLen) {
          dataBuffer.fill(0, dataCursor + baseLen, dataCursor + k);
        }

        // Increment count of k (index k-1)
        dataBuffer[dataCursor + k - 1]++;

        dataCursor += newLen;
        startIndices[nextTarget + 1] = dataCursor;
        found = true;
        break;
      }
    }

    if (!found) {
      // N + 1 = (Ns representation, append 1)
      // Copy prevRep
      const newLen = prevLen; // Length doesn't change when adding 1 (index 0), unless prevLen was 0 (impossible for N>=1)

      ensureBufferCapacity(newLen);
      dataBuffer.set(dataBuffer.subarray(prevStart, prevEnd), dataCursor);

      // Increment count of 1 (index 0)
      dataBuffer[dataCursor]++;

      dataCursor += newLen;
      startIndices[nextTarget + 1] = dataCursor;
    }
  }

  maxCalculated = targetN;
}
