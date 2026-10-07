// Loads the vendored sherpa-onnx WASM modules.
//
// Reality (verified against the v1.13.7 release bundles): each bundle's
// `sherpa-onnx-wasm-main-*.js` is an emscripten script that eagerly creates
// `var Module = typeof Module != "undefined" ? Module : {}` and boots
// immediately, downloading `<name>.data` (preloaded models) + `.wasm` via
// Module.locateFile. So the boot strategy is:
//   1. Set `window.Module = { locateFile, onRuntimeInitialized }` FIRST.
//   2. Dynamically inject `<script src="/sherpa/sherpa-onnx-wasm-main-X.js">`.
//   3. Await runtime init (onRuntimeInitialized or poll of Module calledRun).

export const SHERPA_BASE = '/sherpa';

export interface SherpaModule {
  // Emscripten module surface we rely on
  calledRun?: boolean;
  onRuntimeInitialized?: () => void;
  HEAPF32: Float32Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  // typed-function surface used by the glue scripts
  _malloc(n: number): number;
  _free(p: number): void;
  setValue(ptr: number, value: unknown, type: string): void;
  getValue(ptr: number, type: string): unknown;
  stringToUTF8(str: string, outPtr: number, maxBytes: number): void;
  UTF8ToString(ptr: number): string;
  lengthBytesUTF8(str: string): number;
  FS: {
    writeFile(path: string, data: Uint8Array | string): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
    mkdir(path: string): void;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

type Kind = 'asr' | 'vad' | 'sd';

const MAIN_SCRIPTS: Record<Kind, string> = {
  asr: 'sherpa-onnx-wasm-main-asr.js',
  vad: 'sherpa-onnx-wasm-main-vad.js',
  sd: 'sherpa-onnx-wasm-main-speaker-diarization.js',
};

const booted = new Map<Kind, Promise<SherpaModule>>();

export function bootModule(kind: Kind): Promise<SherpaModule> {
  let p = booted.get(kind);
  if (!p) {
    p = doBoot(kind);
    booted.set(kind, p);
  }
  return p;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // preserve order relative to other injected scripts
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.head.appendChild(s);
  });
}

async function doBoot(kind: Kind): Promise<SherpaModule> {
  // Emscripten uses a module-scope `Module` var; the main scripts read the
  // global one if present. Provide ours before injecting.
  const globalScope = globalThis as unknown as Record<string, unknown>;
  const existing = globalScope.Module as SherpaModule | undefined;
  if (existing && !existing.HEAPF32) {
    // A preconfigured Module from a previous boot attempt — reuse config but
    // this module object belongs to whichever main script loads next.
    globalScope.Module = {
      ...existing,
      locateFile: existing.locateFile ?? ((p: string) => `${SHERPA_BASE}/${p}`),
    };
  } else {
    globalScope.Module = {
      locateFile: (p: string) => {
        if (p.endsWith('.wasm') || p.endsWith('.data') || p.endsWith('.js')) {
          return `${SHERPA_BASE}/${p}`;
        }
        return `${SHERPA_BASE}/${p}`;
      },
      print: (t: string) => console.log('[sherpa]', t),
      printErr: (t: string) => console.warn('[sherpa]', t),
    };
  }

  const mod = globalScope.Module as SherpaModule;

  const initPromise = new Promise<SherpaModule>((resolve, reject) => {
    const prev = mod.onRuntimeInitialized;
    mod.onRuntimeInitialized = () => {
      prev?.();
      resolve(mod);
    };
    // Safety: some builds may not call onRuntimeInitialized if already run.
    void reject;
  });

  await loadScript(`${SHERPA_BASE}/${MAIN_SCRIPTS[kind]}`);

  // Wait for runtime init with a generous timeout (model .data can be ~167MB).
  await Promise.race([
    initPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`sherpa-onnx wasm (${kind}) init timed out`)), 300_000),
    ),
  ]);

  return mod;
}
