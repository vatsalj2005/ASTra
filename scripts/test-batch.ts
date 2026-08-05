import { loadEnv } from "../src/lib/env";
loadEnv();

import { pipeline } from "@xenova/transformers";

async function runBenchmark() {
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    quantized: true,
  });

  const numElements = 64;
  const batchSize = 16;
  const texts = Array.from({ length: numElements }, (_, i) => `this is text element number ${i} which we are using to benchmark batching vs sequential embedding generation inside transformers.js`);

  console.log(`Benchmarking ${numElements} elements...\n`);

  // 1. Sequential Benchmark
  const startSeq = performance.now();
  const resultsSeq: number[][] = [];
  for (const text of texts) {
    const output = await extractor(text, {
      pooling: "mean",
      normalize: true,
    });
    resultsSeq.push(Array.from(output.data as Float32Array));
  }
  const timeSeq = performance.now() - startSeq;
  console.log(`Sequential time: ${timeSeq.toFixed(1)}ms (${(timeSeq / numElements).toFixed(2)}ms/item)`);

  // 2. Batch Benchmark (batchSize = 16)
  const startBatch = performance.now();
  const resultsBatch: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const output = await extractor(batch, {
      pooling: "mean",
      normalize: true,
    });
    const data = output.data as Float32Array;
    const dim = output.dims ? output.dims[1] : 384;
    for (let j = 0; j < batch.length; j++) {
      resultsBatch.push(Array.from(data.subarray(j * dim, (j + 1) * dim)));
    }
  }
  const timeBatch = performance.now() - startBatch;
  console.log(`Batching (size=${batchSize}) time: ${timeBatch.toFixed(1)}ms (${(timeBatch / numElements).toFixed(2)}ms/item)`);

  const speedup = timeSeq / timeBatch;
  console.log(`\nSpeedup: ${speedup.toFixed(2)}x`);

  // 3. Batch Benchmark (batchSize = 32)
  const startBatch32 = performance.now();
  const resultsBatch32: number[][] = [];
  const batchSize32 = 32;
  for (let i = 0; i < texts.length; i += batchSize32) {
    const batch = texts.slice(i, i + batchSize32);
    const output = await extractor(batch, {
      pooling: "mean",
      normalize: true,
    });
    const data = output.data as Float32Array;
    const dim = output.dims ? output.dims[1] : 384;
    for (let j = 0; j < batch.length; j++) {
      resultsBatch32.push(Array.from(data.subarray(j * dim, (j + 1) * dim)));
    }
  }
  const timeBatch32 = performance.now() - startBatch32;
  console.log(`Batching (size=${batchSize32}) time: ${timeBatch32.toFixed(1)}ms (${(timeBatch32 / numElements).toFixed(2)}ms/item)`);
  console.log(`Speedup (size=32): ${(timeSeq / timeBatch32).toFixed(2)}x`);
}

runBenchmark().catch(console.error);
