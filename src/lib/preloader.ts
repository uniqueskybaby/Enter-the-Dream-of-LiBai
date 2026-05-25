export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`预加载失败：${src}`));
    image.src = src;
  });
}

export async function preloadImages(srcs: string[]): Promise<void> {
  await Promise.all(srcs.map((src) => preloadImage(src).catch(() => undefined)));
}
