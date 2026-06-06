type ImageFetchPriority = 'high' | 'low' | 'auto';

interface PreloadImageOptions {
  fetchPriority?: ImageFetchPriority;
}

interface PreloadImagesOptions extends PreloadImageOptions {
  concurrency?: number;
  delayMs?: number;
}

type ImageElementWithPriority = HTMLImageElement & {
  fetchPriority?: ImageFetchPriority;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
    options?: { timeout: number },
  ) => number;
};

const preloadCache = new Map<string, Promise<void>>();

function uniqueSources(srcs: string[]): string[] {
  return Array.from(new Set(srcs.map((src) => src.trim()).filter(Boolean)));
}

function runWhenIdle(callback: () => void): void {
  const win = window as WindowWithIdleCallback;
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(() => callback(), { timeout: 1400 });
    return;
  }

  window.setTimeout(callback, 600);
}

export function preloadImage(src: string, options: PreloadImageOptions = {}): Promise<void> {
  const normalizedSrc = src.trim();
  if (!normalizedSrc) return Promise.resolve();

  const cached = preloadCache.get(normalizedSrc);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    if (options.fetchPriority) {
      (image as ImageElementWithPriority).fetchPriority = options.fetchPriority;
    }
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`预加载失败：${normalizedSrc}`));
    image.src = normalizedSrc;
  }).catch((error: unknown) => {
    preloadCache.delete(normalizedSrc);
    throw error;
  });

  preloadCache.set(normalizedSrc, promise);
  return promise;
}

async function preloadImageBatch(srcs: string[], options: PreloadImagesOptions = {}): Promise<void> {
  const unique = uniqueSources(srcs);
  if (unique.length === 0) return;

  let cursor = 0;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? unique.length, unique.length));
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < unique.length) {
      const src = unique[cursor];
      cursor++;
      await preloadImage(src, { fetchPriority: options.fetchPriority }).catch(() => undefined);
    }
  });

  await Promise.all(workers);
}

export async function preloadImages(srcs: string[], options: PreloadImagesOptions = {}): Promise<void> {
  const unique = uniqueSources(srcs);
  if (unique.length === 0) return;

  const [first, ...rest] = unique;
  await preloadImage(first, { fetchPriority: options.fetchPriority ?? 'high' }).catch(() => undefined);

  if (rest.length > 0) {
    preloadImagesInBackground(rest, {
      fetchPriority: 'low',
      concurrency: 1,
      delayMs: options.delayMs ?? 2800,
    });
  }
}

export function preloadImagesInBackground(srcs: string[], options: PreloadImagesOptions = {}): void {
  const unique = uniqueSources(srcs);
  if (unique.length === 0) return;

  runWhenIdle(() => {
    window.setTimeout(() => {
      void preloadImageBatch(unique, {
        fetchPriority: 'low',
        concurrency: 1,
        ...options,
      });
    }, options.delayMs ?? 1800);
  });
}
