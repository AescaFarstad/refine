
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

export function getHypRepresentation(n: number): Uint16Array {
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
    const maxUsed = prevLen;

    let found = false;

    // Check k from maxUsed + 1 down to 2
    for (let k = maxUsed + 1; k >= 2; k--) {
      const remainder = nextTarget - k;
      // remainder >= 0 is guaranteed since k <= nextTarget

      const baseStart = startIndices[remainder];
      const baseEnd = startIndices[remainder + 1];

      // Check condition: f(k-1) > f(k) + 1
      // f(x) is at index x-1.

      // Get f(k-1) -> index k-2
      const idxKMinus1 = k - 2;
      const countKMinus1 = (baseStart + idxKMinus1 < baseEnd) ? dataBuffer[baseStart + idxKMinus1] : 0;

      // Get f(k) -> index k-1
      const idxK = k - 1;
      const countK = (baseStart + idxK < baseEnd) ? dataBuffer[baseStart + idxK] : 0;

      // Condition: representation has more numbers N than N + 1
      // i.e. f(k-1) > f(k)
      // We are checking if we can add k. New f(k) = countK + 1.
      // So we need countKMinus1 > countK + 1.

      if (countKMinus1 >= countK + 1) {
        // Found valid k
        const baseLen = baseEnd - baseStart;
        const newLen = Math.max(baseLen, k);

        ensureBufferCapacity(newLen);

        if (baseLen > 0) {
          dataBuffer.set(dataBuffer.subarray(baseStart, baseEnd), dataCursor);
        }

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
      const newLen = prevLen;

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
