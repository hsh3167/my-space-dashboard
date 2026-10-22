// Node worker adapter for the exact bundled browser Worker protocol; this is not a browser test.
import { parentPort } from 'node:worker_threads';
globalThis.self = { postMessage: message => parentPort.postMessage(message) };
await import('../assets/xlsx-worker.mjs');
parentPort.on('message', data => globalThis.self.onmessage({ data }));
