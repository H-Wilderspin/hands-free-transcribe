// Generic worker-host bridge: creates a classic Worker per engine kind, loads
// the vendored glue + main wasm scripts inside it, and exchanges
// request/response messages. Audio data is transferred (zero-copy) as
// Float32Array.

export type WorkerRequest =
  | { type: 'init'; config: unknown }
  | { type: 'accept'; samples: Float32Array }
  | { type: 'poll' }
  | { type: 'reset' }
  | { type: 'close' }
  | { type: 'verify'; segment: Float32Array; reference: Float32Array }
  | { type: 'embed'; segment: Float32Array };

export interface WorkerResponse {
  id: number;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

export class EngineWorker {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private onMessageExternal: ((msg: { type: string; payload: unknown }) => void) | null = null;

  constructor(kind: string) {
    // Classic workers live in public/sherpa/workers/ (importScripts-capable,
    // loaded as-is by Vite static serving).
    this.worker = new Worker(`/sherpa/workers/${kind}Worker.js`);
    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as WorkerResponse & { type?: string; payload?: unknown };
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.ok) resolve(msg.payload);
        else reject(new Error(msg.error ?? 'worker error'));
      } else if (msg.type && this.onMessageExternal) {
        this.onMessageExternal({ type: msg.type, payload: msg.payload });
      }
    };
    this.worker.onerror = (e) => {
      const err = new Error(`worker error: ${e.message ?? 'unknown'}`);
      for (const { reject } of this.pending.values()) reject(err);
      this.pending.clear();
    };
  }

  onMessage(handler: (msg: { type: string; payload: unknown }) => void): void {
    this.onMessageExternal = handler;
  }

  call(type: string, payload?: unknown, transfer: Transferable[] = []): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload }, transfer);
    });
  }

  terminate(): void {
    this.worker.terminate();
    for (const { reject } of this.pending.values()) {
      reject(new Error('worker terminated'));
    }
    this.pending.clear();
  }
}
