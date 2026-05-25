import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PLAYER_AI_DREAM_LABEL = '玩家AI生成';
const FALLBACK_PANORAMA_URL = '/assets/panoramas/lushan_main_4096x2048.jpg';
const MOON_FALLBACK_PANORAMA_URL = '/assets/panoramas/moon_three_main_4096x2048.jpg';
const YELLOW_RIVER_FALLBACK_PANORAMA_URL = '/assets/panoramas/yellow_river_main_4096x2048.jpg';
const YANGTZE_FALLBACK_PANORAMA_URL = '/assets/panoramas/yangtze_farewell_main_4096x2048.jpg';

export function localDreamsPlugin() {
  const root = process.cwd();
  const publicDir = path.join(root, 'public');
  const dataDir = path.join(publicDir, 'data');
  const panoramaDir = path.join(publicDir, 'assets', 'panoramas');
  const manifestPath = path.join(dataDir, 'dreams_manifest.json');

  return {
    name: 'local-dreams-plugin',
    configureServer(server) {
      server.middlewares.use('/api/local-dreams/save', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const config = body?.config;
          if (!config?.nodes?.length || !config?.poem || !config?.world) {
            sendJson(res, 400, { error: '梦境配置不完整' });
            return;
          }

          await mkdir(dataDir, { recursive: true });
          await mkdir(panoramaDir, { recursive: true });

          const manifest = await readJsonFile(manifestPath, []);
          const existingIds = new Set([
            ...manifest.map((dream) => dream.gameId).filter(Boolean),
            ...(await existingDataIds(dataDir)),
          ]);
          const gameId = uniqueGameId(config, existingIds);
          const savedAt = new Date().toISOString();
          const fallbackPanorama = contextualFallbackPanoramaUrl(config);

          const nextConfig = {
            ...config,
            gameId,
            meta: {
              ...config.meta,
              origin: 'player-ai',
              savedAt,
            },
          };

          nextConfig.nodes = await Promise.all(nextConfig.nodes.map(async (node, index) => {
            const imageUrl = await materializeImage({
              url: node.panoramaUrl,
              baseName: `${gameId}_${safeSegment(node.id || `scene_${index + 1}`)}`,
              fallbackUrl: fallbackPanorama,
              panoramaDir,
            });
            return { ...node, panoramaUrl: imageUrl };
          }));

          const endingEntries = await Promise.all(Object.entries(nextConfig.endings ?? {}).map(async ([id, ending]) => {
            if (!ending?.imageUrl) return [id, ending];
            const imageUrl = await materializeImage({
              url: ending.imageUrl,
              baseName: `${gameId}_${safeSegment(id)}`,
              fallbackUrl: '',
              panoramaDir,
            });
            return [id, imageUrl ? { ...ending, imageUrl } : { ...ending, imageUrl: undefined }];
          }));
          nextConfig.endings = Object.fromEntries(endingEntries);

          const configUrl = `/data/${gameId}.json`;
          const configPath = path.join(dataDir, `${gameId}.json`);
          await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');

          const manifestEntry = {
            gameId,
            title: nextConfig.title,
            poemLine: nextConfig.poem.line,
            source: nextConfig.poem.source || 'AI 诗境',
            worldName: nextConfig.world.worldName,
            configUrl,
            coverUrl: nextConfig.nodes[0]?.panoramaUrl || fallbackPanorama,
            theme: PLAYER_AI_DREAM_LABEL,
            origin: 'player-ai',
            savedAt,
          };

          const nextManifest = [
            ...manifest.filter((dream) => dream.gameId !== gameId),
            manifestEntry,
          ];
          await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');

          sendJson(res, 200, { config: nextConfig, manifestEntry });
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : '保存梦境失败' });
        }
      });
    },
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function existingDataIds(dataDir) {
  try {
    const names = await readdir(dataDir);
    return names
      .filter((name) => name.endsWith('.json') && name !== 'dreams_manifest.json')
      .map((name) => name.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

async function materializeImage({ url, baseName, fallbackUrl, panoramaDir }) {
  if (!url || url.startsWith('__PLACEHOLDER') || url.startsWith('blob:')) return fallbackUrl;
  if (url.startsWith('/assets/')) return url;

  let bytes;
  let mime = '';

  if (url.startsWith('data:')) {
    const parsed = parseDataUrl(url);
    if (!parsed) return fallbackUrl;
    bytes = parsed.bytes;
    mime = parsed.mime;
  } else if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) return fallbackUrl;
    bytes = Buffer.from(await response.arrayBuffer());
    mime = response.headers.get('content-type') || '';
  } else {
    return url;
  }

  const ext = extensionForMime(mime) || extensionFromUrl(url) || 'png';
  const fileName = `${baseName}.${ext}`;
  await writeFile(path.join(panoramaDir, fileName), bytes);
  return `/assets/panoramas/${fileName}`;
}

function parseDataUrl(url) {
  const match = url.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1] || 'image/png',
    bytes: Buffer.from(match[2], 'base64'),
  };
}

function extensionForMime(mime) {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return '';
}

function extensionFromUrl(url) {
  try {
    const clean = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
    const ext = path.extname(clean).replace('.', '').toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : '';
  } catch {
    return '';
  }
}

function uniqueGameId(config, existingIds) {
  const raw = config.gameId || config.poem?.source || config.world?.worldName || 'dream_generated';
  const normalized = safeSegment(raw).replace(/^dream-generated-?/, '').replace(/^dream_generated_?/, '');
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const base = `dream_generated_${normalized || stamp}`;
  let next = base;
  let index = 2;

  while (existingIds.has(next)) {
    next = `${base}_${index}`;
    index += 1;
  }

  return next;
}

function safeSegment(value) {
  const ascii = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ascii || `item_${Date.now().toString(36)}`;
}

function contextualFallbackPanoramaUrl(config) {
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

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
