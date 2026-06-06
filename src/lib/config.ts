import type { DreamManifestEntry, PanoramaGameConfig } from '../types/game';

const PUBLIC_BASE_URL = import.meta.env.BASE_URL || '/';
const WEBP_PANORAMA_STEMS = new Set([
  'branch_moon_bridge_4096x2048',
  'branch_moon_toast_4096x2048',
  'branch_silent_peak_4096x2048',
  'lushan_main_4096x2048',
  'moon_three_main_4096x2048',
  'moon_three_shadow_4096x2048',
  'moon_three_silent_4096x2048',
  'moon_three_toast_4096x2048',
  'yangtze_farewell_horizon_4096x2048',
  'yangtze_farewell_main_4096x2048',
  'yangtze_farewell_pavilion_4096x2048',
  'yangtze_farewell_sail_4096x2048',
  'yellow_river_canyon_4096x2048',
  'yellow_river_main_4096x2048',
  'yellow_river_sea_4096x2048',
  'yellow_river_source_4096x2048',
]);

function splitUrlSuffix(path: string): [string, string] {
  const suffixIndex = path.search(/[?#]/);
  return suffixIndex === -1 ? [path, ''] : [path.slice(0, suffixIndex), path.slice(suffixIndex)];
}

function removePublicBasePrefix(path: string): string {
  const normalized = `/${path.replace(/^\/+/, '')}`;
  const base = PUBLIC_BASE_URL.replace(/^\/+|\/+$/g, '');
  if (!base) return normalized;

  const basePrefix = `/${base}`;
  return normalized.startsWith(`${basePrefix}/`) ? normalized.slice(basePrefix.length) : normalized;
}

function publicUrl(path: string): string {
  if (/^(https?:|data:|blob:|local:\/\/)/i.test(path)) return path;
  if (path.startsWith('./') || path.startsWith('../')) return path;

  const base = PUBLIC_BASE_URL.endsWith('/') ? PUBLIC_BASE_URL : `${PUBLIC_BASE_URL}/`;
  const [pathOnly, suffix] = splitUrlSuffix(path);
  const normalized = removePublicBasePrefix(pathOnly);
  return `${base}${normalized.replace(/^\/+/, '')}${suffix}`;
}

function optimizedPublicImageUrl(path: string): string {
  if (!path || /^(https?:|data:|blob:|local:\/\/)/i.test(path)) return path;
  if (path.startsWith('./') || path.startsWith('../')) return path;

  const [pathOnly, suffix] = splitUrlSuffix(path);
  const normalized = removePublicBasePrefix(pathOnly);
  const match = normalized.match(/^\/assets\/panoramas\/([^/]+)\.(?:jpe?g|png)$/i);
  const optimized = match && WEBP_PANORAMA_STEMS.has(match[1])
    ? `/assets/panoramas/${match[1]}.webp`
    : normalized;

  return publicUrl(`${optimized}${suffix}`);
}

function resolveManifestPublicUrls(dream: DreamManifestEntry): DreamManifestEntry {
  return {
    ...dream,
    configUrl: publicUrl(dream.configUrl),
    coverUrl: optimizedPublicImageUrl(dream.coverUrl),
  };
}

function resolveConfigPublicUrls(config: PanoramaGameConfig): PanoramaGameConfig {
  return {
    ...config,
    nodes: config.nodes.map((node) => ({
      ...node,
      panoramaUrl: optimizedPublicImageUrl(node.panoramaUrl),
    })),
    endings: Object.fromEntries(
      Object.entries(config.endings).map(([id, ending]) => [
        id,
        {
          ...ending,
          imageUrl: ending.imageUrl ? optimizedPublicImageUrl(ending.imageUrl) : ending.imageUrl,
        },
      ]),
    ),
  };
}

const DEFAULT_CONFIG_URL = publicUrl('/data/dream_li_bai_lushan_v1.json');
const GENERATED_DREAMS_KEY = 'dream-li-bai-generated-dreams';
const GENERATED_CONFIG_URL_PREFIX = 'local://generated-dream/';
const FALLBACK_COVER_URL = publicUrl('/assets/ui/cover-lushan.jpg');
const FALLBACK_PANORAMA_URL = optimizedPublicImageUrl('/assets/panoramas/lushan_main_4096x2048.jpg');
const MOON_FALLBACK_PANORAMA_URL = optimizedPublicImageUrl('/assets/panoramas/moon_three_main_4096x2048.jpg');
const YELLOW_RIVER_FALLBACK_PANORAMA_URL = optimizedPublicImageUrl('/assets/panoramas/yellow_river_main_4096x2048.jpg');
const YANGTZE_FALLBACK_PANORAMA_URL = optimizedPublicImageUrl('/assets/panoramas/yangtze_farewell_main_4096x2048.jpg');
export const PLAYER_AI_DREAM_LABEL = '玩家AI生成';

interface StoredGeneratedDream {
  config: PanoramaGameConfig;
  savedAt: string;
}

const fallbackManifest: DreamManifestEntry[] = [
  {
    gameId: 'dream_li_bai_lushan_v1',
    title: '入梦李白：望庐山瀑布',
    poemLine: '飞流直下三千尺，疑是银河落九天。',
    source: '望庐山瀑布',
    worldName: '庐山银河梦境',
    configUrl: DEFAULT_CONFIG_URL,
    coverUrl: FALLBACK_COVER_URL,
    theme: '蓝银月光',
    origin: 'built-in',
  },
];

export async function loadDreamManifest(): Promise<DreamManifestEntry[]> {
  let manifest = fallbackManifest;

  try {
    const response = await fetch(publicUrl('/data/dreams_manifest.json'));
    if (response.ok) {
      const remoteManifest = (await response.json()) as DreamManifestEntry[];
      manifest = remoteManifest.length > 0
        ? remoteManifest.map((dream) => resolveManifestPublicUrls({ ...dream, origin: dream.origin ?? 'built-in' }))
        : fallbackManifest;
    }
  } catch {
    manifest = fallbackManifest;
  }

  return [...manifest, ...loadGeneratedDreamManifest()];
}

export async function loadGameConfig(gameIdOrUrl?: string): Promise<PanoramaGameConfig> {
  if (gameIdOrUrl?.startsWith(GENERATED_CONFIG_URL_PREFIX)) {
    const generatedId = gameIdOrUrl.slice(GENERATED_CONFIG_URL_PREFIX.length);
    const generated = loadGeneratedDreamConfig(generatedId);
    if (generated) return generated;
  }

  if (gameIdOrUrl && !gameIdOrUrl.startsWith('/')) {
    const generated = loadGeneratedDreamConfig(gameIdOrUrl);
    if (generated) return generated;
  }

  let configUrl = DEFAULT_CONFIG_URL;

  if (gameIdOrUrl?.startsWith('/')) {
    configUrl = publicUrl(gameIdOrUrl);
  } else if (gameIdOrUrl && (gameIdOrUrl.startsWith('./') || gameIdOrUrl.startsWith('../') || /^https?:/i.test(gameIdOrUrl))) {
    configUrl = publicUrl(gameIdOrUrl);
  } else if (gameIdOrUrl) {
    const manifest = await loadDreamManifest();
    configUrl = manifest.find((dream) => dream.gameId === gameIdOrUrl)?.configUrl ?? DEFAULT_CONFIG_URL;
  }

  const response = await fetch(configUrl);

  if (!response.ok) {
    throw new Error(`加载梦境配置失败：${response.status}`);
  }

  return resolveConfigPublicUrls((await response.json()) as PanoramaGameConfig);
}

export async function saveGeneratedDreamConfig(config: PanoramaGameConfig): Promise<PanoramaGameConfig> {
  const projectConfig = await saveGeneratedDreamToProjectFiles(config);
  if (projectConfig) return repairGeneratedFallbackImages(projectConfig);
  return saveGeneratedDreamConfigToBrowser(config);
}

function saveGeneratedDreamConfigToBrowser(config: PanoramaGameConfig): PanoramaGameConfig {
  const storedDreams = readGeneratedDreams();
  const gameId = makeGeneratedGameId(config, new Set(storedDreams.map((dream) => dream.config.gameId)));
  const savedAt = new Date().toISOString();
  const playableConfig = tagGeneratedConfig({ ...config, gameId }, savedAt);
  const storageConfig = sanitizeGeneratedConfig(playableConfig);
  const nextDreams = [
    { config: storageConfig, savedAt },
    ...storedDreams,
  ];

  writeGeneratedDreams(nextDreams);
  return playableConfig;
}

async function saveGeneratedDreamToProjectFiles(config: PanoramaGameConfig): Promise<PanoramaGameConfig | undefined> {
  if (typeof window === 'undefined') return undefined;

  try {
    const response = await fetch('/api/local-dreams/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    if (!response.ok) return undefined;

    const data = (await response.json()) as { config?: PanoramaGameConfig };
    return data.config?.nodes?.length ? data.config : undefined;
  } catch {
    return undefined;
  }
}

function loadGeneratedDreamManifest(): DreamManifestEntry[] {
  return readGeneratedDreams().map((dream) => manifestEntryFromConfig(dream.config, dream.savedAt));
}

function loadGeneratedDreamConfig(gameId: string): PanoramaGameConfig | undefined {
  const stored = readGeneratedDreams().find((dream) => dream.config.gameId === gameId);
  return stored
    ? resolveConfigPublicUrls(repairGeneratedFallbackImages(tagGeneratedConfig(cloneConfig(stored.config), stored.savedAt || stored.config.meta?.savedAt || '')))
    : undefined;
}

function manifestEntryFromConfig(config: PanoramaGameConfig, savedAt?: string): DreamManifestEntry {
  const repairedConfig = repairGeneratedFallbackImages(config);
  return {
    gameId: repairedConfig.gameId,
    title: repairedConfig.title,
    poemLine: repairedConfig.poem.line,
    source: repairedConfig.poem.source || 'AI 诗境',
    worldName: repairedConfig.world.worldName,
    configUrl: `${GENERATED_CONFIG_URL_PREFIX}${repairedConfig.gameId}`,
    coverUrl: firstStableImageUrl(repairedConfig) ?? contextualFallbackPanoramaUrl(repairedConfig) ?? FALLBACK_COVER_URL,
    theme: PLAYER_AI_DREAM_LABEL,
    origin: 'player-ai',
    savedAt: savedAt || repairedConfig.meta?.savedAt,
  };
}

function readGeneratedDreams(): StoredGeneratedDream[] {
  try {
    const raw = localStorage.getItem(GENERATED_DREAMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<StoredGeneratedDream | PanoramaGameConfig>;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => (item && typeof item === 'object' && 'config' in item ? item : { config: item as PanoramaGameConfig, savedAt: '' }))
      .map((item) => ({ ...item, savedAt: item.savedAt || item.config.meta?.savedAt || '' }))
      .filter((item): item is StoredGeneratedDream => Boolean(item.config?.gameId && item.config?.nodes?.length));
  } catch {
    return [];
  }
}

function writeGeneratedDreams(dreams: StoredGeneratedDream[]): void {
  try {
    localStorage.setItem(GENERATED_DREAMS_KEY, JSON.stringify(dreams));
  } catch {
    const leanDreams = dreams.map((dream) => ({
      ...dream,
      config: sanitizeGeneratedConfig(dream.config, true),
    }));
    try {
      localStorage.setItem(GENERATED_DREAMS_KEY, JSON.stringify(leanDreams));
    } catch {
      return;
    }
  }
}

function cloneConfig(config: PanoramaGameConfig): PanoramaGameConfig {
  return JSON.parse(JSON.stringify(config)) as PanoramaGameConfig;
}

function tagGeneratedConfig(config: PanoramaGameConfig, savedAt: string): PanoramaGameConfig {
  return {
    ...config,
    meta: {
      ...config.meta,
      origin: 'player-ai',
      savedAt,
    },
  };
}

function sanitizeGeneratedConfig(config: PanoramaGameConfig, forceFallbackImages = false): PanoramaGameConfig {
  const cloned = cloneConfig(config);
  const fallbackPanoramaUrl = contextualFallbackPanoramaUrl(cloned);
  cloned.nodes = cloned.nodes.map((node) => ({
    ...node,
    panoramaUrl: forceFallbackImages || !isStableImageUrl(node.panoramaUrl) ? fallbackPanoramaUrl : node.panoramaUrl,
  }));

  cloned.endings = Object.fromEntries(
    Object.entries(cloned.endings).map(([id, ending]) => {
      const imageUrl = ending.imageUrl;
      if (forceFallbackImages || !isStableImageUrl(imageUrl)) {
        const { imageUrl: _imageUrl, ...rest } = ending;
        return [id, rest];
      }
      return [id, ending];
    }),
  );

  return cloned;
}

function firstStableImageUrl(config: PanoramaGameConfig): string | undefined {
  return config.nodes.map((node) => node.panoramaUrl).find(isStableImageUrl);
}

function isStableImageUrl(url?: string): url is string {
  return Boolean(url && !url.startsWith('blob:') && !url.startsWith('__PLACEHOLDER'));
}

export function contextualFallbackPanoramaUrl(config: PanoramaGameConfig): string {
  const context = [
    config.title,
    config.poem?.source,
    config.poem?.line,
    config.world?.worldName,
    config.world?.visualTone,
  ].filter(Boolean).join(' ');

  if (/月|明月|关山月|夜色|影/.test(context)) return MOON_FALLBACK_PANORAMA_URL;
  if (/[黄河金涛天水奔流海]/.test(context)) return YELLOW_RIVER_FALLBACK_PANORAMA_URL;
  if (/[长江孤帆送别黄鹤广陵碧空]/.test(context)) return YANGTZE_FALLBACK_PANORAMA_URL;
  if (/[庐山瀑布银河]/.test(context)) return FALLBACK_PANORAMA_URL;
  return MOON_FALLBACK_PANORAMA_URL;
}

function repairGeneratedFallbackImages(config: PanoramaGameConfig): PanoramaGameConfig {
  if (config.meta?.origin !== 'player-ai' && !config.gameId.startsWith('dream_generated')) return config;

  const fallbackPanoramaUrl = contextualFallbackPanoramaUrl(config);
  if (fallbackPanoramaUrl === FALLBACK_PANORAMA_URL) return config;

  return {
    ...config,
    nodes: config.nodes.map((node) => (
      node.panoramaUrl === FALLBACK_PANORAMA_URL
        ? { ...node, panoramaUrl: fallbackPanoramaUrl }
        : node
    )),
  };
}

function makeGeneratedGameId(config: PanoramaGameConfig, existingIds: Set<string>): string {
  const rawId = config.gameId || `dream_generated_${Date.now().toString(36)}`;
  const normalized = rawId
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const baseId = normalized.startsWith('dream_generated') ? normalized : `dream_generated_${Date.now().toString(36)}`;
  let nextId = baseId || `dream_generated_${Date.now().toString(36)}`;
  let index = 2;

  while (existingIds.has(nextId)) {
    nextId = `${baseId}_${index}`;
    index++;
  }

  return nextId;
}
