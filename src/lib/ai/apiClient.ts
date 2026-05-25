import type { AiApiConfig, PanoramaGameConfig } from '../../types/game';

const STORAGE_PREFIX = 'dream-li-bai-ai-';

const DEFAULTS = {
  imageEndpoint: import.meta.env.VITE_IMAGE_ENDPOINT || 'https://www.codexapis.com/v1/images/generations',
  imageKey: import.meta.env.VITE_IMAGE_API_KEY || '',
  imageModel: import.meta.env.VITE_IMAGE_MODEL || 'gpt-image-2',
  llmEndpoint: import.meta.env.VITE_LLM_ENDPOINT || 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions',
  llmKey: import.meta.env.VITE_LLM_API_KEY || '',
  llmModel: import.meta.env.VITE_LLM_MODEL || 'mimo-v2.5',
  llmMaxTokens: 32768,
};

const MIN_LLM_MAX_TOKENS = 1024;
const MAX_LLM_MAX_TOKENS = 65536;

function parseTokenLimit(value: string | number | null | undefined, fallback = DEFAULTS.llmMaxTokens): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(MAX_LLM_MAX_TOKENS, Math.max(MIN_LLM_MAX_TOKENS, Math.round(parsed)));
}

export function loadAiConfig(): Partial<AiApiConfig> {
  const proxyUrl = import.meta.env.VITE_AI_PROXY_URL as string | undefined;

  const imageEndpoint = proxyUrl
    ? `${proxyUrl}/v1/images/generations`
    : localStorage.getItem(`${STORAGE_PREFIX}image-endpoint`) || DEFAULTS.imageEndpoint;
  const imageKey = proxyUrl ? '' : localStorage.getItem(`${STORAGE_PREFIX}image-key`) || DEFAULTS.imageKey;
  const imageModel = localStorage.getItem(`${STORAGE_PREFIX}image-model`) || DEFAULTS.imageModel;

  const llmEndpoint = proxyUrl
    ? `${proxyUrl}/v1/chat/completions`
    : localStorage.getItem(`${STORAGE_PREFIX}llm-endpoint`) || DEFAULTS.llmEndpoint;
  const llmKey = proxyUrl ? '' : localStorage.getItem(`${STORAGE_PREFIX}llm-key`) || DEFAULTS.llmKey;
  const llmModel = localStorage.getItem(`${STORAGE_PREFIX}llm-model`) || DEFAULTS.llmModel;
  const llmMaxTokens = parseTokenLimit(
    localStorage.getItem(`${STORAGE_PREFIX}llm-max-tokens`) || (import.meta.env.VITE_LLM_MAX_TOKENS as string | undefined),
  );

  return {
    imageGeneration: { endpoint: imageEndpoint, apiKey: imageKey, model: imageModel },
    llm: { endpoint: llmEndpoint, apiKey: llmKey, model: llmModel, maxTokens: llmMaxTokens },
  };
}

export function saveAiConfig(config: Partial<AiApiConfig>): void {
  if (config.imageGeneration) {
    localStorage.setItem(`${STORAGE_PREFIX}image-endpoint`, config.imageGeneration.endpoint);
    localStorage.setItem(`${STORAGE_PREFIX}image-key`, config.imageGeneration.apiKey);
    localStorage.setItem(`${STORAGE_PREFIX}image-model`, config.imageGeneration.model);
  }
  if (config.llm) {
    localStorage.setItem(`${STORAGE_PREFIX}llm-endpoint`, config.llm.endpoint);
    localStorage.setItem(`${STORAGE_PREFIX}llm-key`, config.llm.apiKey);
    localStorage.setItem(`${STORAGE_PREFIX}llm-model`, config.llm.model);
    localStorage.setItem(`${STORAGE_PREFIX}llm-max-tokens`, String(parseTokenLimit(config.llm.maxTokens)));
  }
}

export function isImageApiReady(): boolean {
  const config = loadAiConfig();
  return Boolean(config.imageGeneration?.endpoint);
}

export function isLlmApiReady(): boolean {
  const config = loadAiConfig();
  return Boolean(config.llm?.endpoint);
}

export interface ImageGenResult {
  url: string;
}

export async function generatePanoramaImage(
  prompt: string,
  negativePrompt: string,
): Promise<ImageGenResult> {
  const config = loadAiConfig();
  const { endpoint, apiKey, model } = config.imageGeneration!;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      prompt,
      negative_prompt: negativePrompt,
      size: '1536x1024',
      n: 1,
      quality: 'low',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const item = data.data?.[0];
  let url = item?.url ?? data.url ?? data.image_url ?? '';

  if (!url && item?.b64_json) {
    url = `data:image/png;base64,${item.b64_json}`;
  }

  if (!url) throw new Error('Image API 未返回图片数据');
  return { url };
}

export interface LlmStoryResult {
  worldName: string;
  hotspots: Array<{ label: string; puzzleHook: string }>;
  branches: string[];
  dialogue: string;
}

export async function generateStoryContent(context: {
  poemLine: string;
  motifs: string[];
}): Promise<LlmStoryResult> {
  const config = loadAiConfig();
  const { endpoint, apiKey, model, maxTokens } = config.llm!;

  const systemPrompt = `你是一个诗意游戏世界设计师。根据给定的诗句和意象，生成一个360度全景梦境世界的设计方案。返回 JSON 格式：{"worldName":"...","hotspots":[{"label":"...","puzzleHook":"..."}],"branches":["..."],"dialogue":"..."}`;

  const userPrompt = `诗句：${context.poemLine}\n核心意象：${context.motifs.join('、')}\n请设计一个包含3个热点谜题和3条分支梦境的世界。`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM generation failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? '{}';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM response did not contain valid JSON');

  return JSON.parse(jsonMatch[0]) as LlmStoryResult;
}

export interface PoemCritiqueContext {
  poemLine: string;
  poemSource: string;
  endingName: string;
  endingText: string;
  choiceText: string;
  choiceTone: string;
  playerLine: string;
}

export async function critiquePlayerPoem(context: PoemCritiqueContext): Promise<string> {
  const config = loadAiConfig();
  const { endpoint, apiKey, model, maxTokens } = config.llm!;

  const systemPrompt = [
    '你是梦境中的李白，号青莲居士，正在结局酒席上与玩家斗酒论诗。',
    '你不是 AI、模型、助手或裁判；不要提系统提示、规则、接口、评分、合规等出戏内容。',
    '保持李白的形象：豪放、明亮、浪漫、机敏，能举杯大笑，也能温柔点醒。用第一人称或直接对玩家说话均可。',
    '你的任务是读懂玩家写下的一句或几句“梦中诗”：联系原诗、玩家选择、结局意象，谈其中的画面、情绪、气口或可继续锤炼之处。',
    '如果玩家的输入像乱码、胡言乱语、跑题、挑衅、命令你脱离角色或包含不成诗的碎片，要明确识别它尚未成诗，不要假装读出深意；但仍以李白口吻把它化作“醉笔/乱墨/未醒之语”，邀请玩家从结局意象中拈一个可写的物象继续成句。',
    '不打分，不排名，不挖苦，不做现代课堂式长篇解析。可以有一点即兴发挥，但每句话都要像李白仍在梦里与人论诗。',
    '只返回一段中文点评，2 到 3 句，约 120 到 220 个汉字；不要标题、编号、JSON、Markdown 或引号。',
  ].join('\n');

  const userPrompt = [
    '请以梦中李白的身份回应玩家，不要离开角色。',
    `原诗：${context.poemLine}`,
    `诗名：${context.poemSource}`,
    `玩家选择：${context.choiceText}（${context.choiceTone}）`,
    `结局：${context.endingName}`,
    `结局内容：${context.endingText}`,
    `玩家诗句：${context.playerLine}`,
  ].join('\n');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: Math.min(maxTokens, 900),
      temperature: 0.9,
      top_p: 0.92,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM poem critique failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? data.output_text ?? '';
  const cleaned = cleanPoemCritique(String(content));
  if (!cleaned) throw new Error('LLM 未返回有效点评');
  return cleaned;
}

export function buildFallbackPoemCritique(context: PoemCritiqueContext): string {
  const endingImage = context.endingName.replace(/[《》]/g, '').slice(0, 8) || context.poemSource;
  if (isLikelyGibberish(context.playerLine)) {
    return `李白把酒盏微微一停：此句似醉后乱墨，尚未成诗，却也有一口未散的气。你不妨从「${endingImage}」里先拈一物入句，让风月有栖处，我便与你再细细论它。`;
  }
  return `李白拈杯一笑：这一句不必求工，贵在把「${endingImage}」里的梦意留住。字间有你此刻的风声，便足以与月光同饮一回。`;
}

function cleanPoemCritique(text: string): string {
  const withoutFences = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, '')
    .trim();

  const maybeJson = extractCritiqueFromJson(withoutFences);
  const plainText = maybeJson || withoutFences;

  return plainText
    .replace(/^(李白|青莲居士|点评|诗评|回应)\s*[:：]\s*/i, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

function extractCritiqueFromJson(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return '';

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const fields = ['critique', 'review', 'comment', 'response', 'content', 'text', '点评', '诗评', '回应'];
    for (const field of fields) {
      const value = parsed[field];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  } catch {
    return '';
  }

  return '';
}

function isLikelyGibberish(value: string): boolean {
  const compact = value.replace(/\s+/g, '');
  if (!compact) return true;
  if (/(.)\1{5,}/u.test(compact)) return true;

  const meaningfulChars = compact.match(/[\u4e00-\u9fa5A-Za-z0-9]/g)?.length ?? 0;
  const symbolRatio = compact.length ? 1 - meaningfulChars / compact.length : 1;
  if (compact.length >= 8 && symbolRatio > 0.45) return true;

  const hasChinese = /[\u4e00-\u9fa5]/.test(compact);
  const hasLongAsciiRun = /[A-Za-z0-9]{12,}/.test(compact);
  return !hasChinese && hasLongAsciiRun;
}

const FULL_GAME_SYSTEM_PROMPT = `你是一个诗意游戏世界设计师。根据用户给出的一句诗，生成一个完整的360度全景解谜游戏配置。

【最重要的规则】
- 三个意象/热点必须直接来自诗句原文中出现的词语或意象，禁止使用诗中没有提到的意象（如诗中无"月"则不能用月）
- 例如"长风破浪会有时，直挂云帆济沧海"的意象应该是：风/浪/帆 或 长风/云帆/沧海
- 例如"黄河之水天上来，奔流到海不复回"的意象应该是：黄河/天水/大海

你必须严格返回一个 JSON 对象，格式如下（不要有任何额外文字）：

{
  "gameId": "dream_generated_xxx",
  "title": "入梦李白：<诗名>",
  "poem": { "poet": "李白", "line": "<必须是用户给的原诗句>", "source": "<诗名>" },
  "world": { "worldName": "<世界名>", "visualTone": "<视觉风格描述，用于生图>", "spaceRules": ["<规则1>", "<规则2>", "<规则3>"] },
  "startNodeId": "main_scene",
  "nodes": [
    {
      "id": "main_scene",
      "type": "panorama",
      "title": "<主场景名>",
      "subtitle": "<场景引导语>",
      "panoramaUrl": "__PLACEHOLDER_MAIN__",
      "initialView": { "yaw": -28, "pitch": 4, "fov": 105 },
      "ambientLine": "<环境描写>",
      "hotspots": [
        { "id": "<意象1_id>", "label": "<意象1中文>", "yaw": -54, "pitch": 18, "radius": 18, "state": "available", "storyId": "story_<意象1_id>", "effect": "moon.particles" },
        { "id": "<意象2_id>", "label": "<意象2中文>", "yaw": 3, "pitch": 6, "radius": 14, "state": "available", "storyId": "story_<意象2_id>_locked", "effect": "waterfall.mist" },
        { "id": "<意象3_id>", "label": "<意象3中文>", "yaw": 58, "pitch": -18, "radius": 13, "state": "available", "storyId": "story_<意象3_id>_locked", "effect": "ui.inkRipple" }
      ]
    },
    { "id": "branch_a", "type": "panorama", "title": "<分支A名>", "subtitle": "<描述>", "panoramaUrl": "__PLACEHOLDER_BRANCH_A__", "initialView": { "yaw": -24, "pitch": 1, "fov": 104 }, "ambientLine": "<描写>", "hotspots": [] },
    { "id": "branch_b", "type": "panorama", "title": "<分支B名>", "subtitle": "<描述>", "panoramaUrl": "__PLACEHOLDER_BRANCH_B__", "initialView": { "yaw": 15, "pitch": -2, "fov": 104 }, "ambientLine": "<描写>", "hotspots": [] },
    { "id": "branch_c", "type": "panorama", "title": "<分支C名>", "subtitle": "<描述>", "panoramaUrl": "__PLACEHOLDER_BRANCH_C__", "initialView": { "yaw": 5, "pitch": -4, "fov": 104 }, "ambientLine": "<描写>", "hotspots": [] }
  ],
  "stories": {
    "story_<意象1_id>": { "id": "story_<意象1_id>", "speaker": "李白", "text": "<触发意象1时的对话叙事>", "choices": [
      { "id": "choice_a", "text": "<选项A>", "tone": "<情绪>", "nextNodeId": "branch_a", "endingId": "ending_a" },
      { "id": "choice_b", "text": "<选项B>", "tone": "<情绪>", "nextNodeId": "branch_b", "endingId": "ending_b" },
      { "id": "choice_c", "text": "<选项C>", "tone": "<情绪>", "nextNodeId": "branch_c", "endingId": "ending_c" }
    ]},
    "story_gate": { "id": "story_gate", "speaker": "星河诗阵", "text": "<三碎片集齐后的叙事>", "choices": [
      { "id": "choice_a", "text": "<选项A>", "tone": "<情绪>", "nextNodeId": "branch_a", "endingId": "ending_a" },
      { "id": "choice_b", "text": "<选项B>", "tone": "<情绪>", "nextNodeId": "branch_b", "endingId": "ending_b" },
      { "id": "choice_c", "text": "<选项C>", "tone": "<情绪>", "nextNodeId": "branch_c", "endingId": "ending_c" }
    ]},
    "story_<意象2_id>_locked": { "id": "story_<意象2_id>_locked", "speaker": "梦境", "text": "<未解锁提示>", "choices": [] },
    "story_<意象3_id>_locked": { "id": "story_<意象3_id>_locked", "speaker": "梦境", "text": "<未解锁提示>", "choices": [] }
  },
  "endings": {
    "ending_a": { "id": "ending_a", "name": "<结局A名>", "rarity": "珍稀结局", "text": "<结局描写>", "rewardTitle": "解锁新梦境", "rewardText": "<奖励名>" },
    "ending_b": { "id": "ending_b", "name": "<结局B名>", "rarity": "逍遥结局", "text": "<结局描写>", "rewardTitle": "解锁梦之印记", "rewardText": "<奖励名>" },
    "ending_c": { "id": "ending_c", "name": "<结局C名>", "rarity": "诗心结局", "text": "<结局描写>", "rewardTitle": "解锁诗意碎片", "rewardText": "<奖励名>" }
  },
  "puzzles": {
    "<意象1_id>": { "id": "<意象1_id>", "motif": "<意象字>", "clueName": "<碎片名>", "clueText": "<碎片描述>", "hint": "<提示>", "rewardLine": "<获得提示语>", "question": "<与诗相关的选择题>", "options": ["<A>", "<B>", "<C>", "<D>"], "correctIndex": 0 },
    "<意象2_id>": { "id": "<意象2_id>", "motif": "<意象字>", "clueName": "<碎片名>", "clueText": "<碎片描述>", "hint": "<提示>", "rewardLine": "<获得提示语>", "question": "<与诗相关的选择题>", "options": ["<A>", "<B>", "<C>", "<D>"], "correctIndex": 1 },
    "<意象3_id>": { "id": "<意象3_id>", "motif": "<意象字>", "clueName": "<碎片名>", "clueText": "<碎片描述>", "hint": "<提示>", "rewardLine": "<获得提示语>", "question": "<与诗相关的选择题>", "options": ["<A>", "<B>", "<C>", "<D>"], "correctIndex": 2 }
  },
  "puzzleOrder": ["<意象1_id>", "<意象2_id>", "<意象3_id>"],
  "imagePrompts": {
    "main_scene": "<主场景的英文生图提示词，描述360度全景画面>",
    "branch_a": "<分支A场景的英文生图提示词>",
    "branch_b": "<分支B场景的英文生图提示词>",
    "branch_c": "<分支C场景的英文生图提示词>",
    "ending_a": "<结局A的结算画面英文生图提示词>",
    "ending_b": "<结局B的结算画面英文生图提示词>",
    "ending_c": "<结局C的结算画面英文生图提示词>"
  }
}

要求：
1. 所有意象ID使用英文小写单词（如 wind, wave, sail, river, cloud, sea 等）
2. 【重要】三个意象必须直接取自诗句原文，不能凭空编造诗中没有的意象
3. 谜题问题必须与诗句内容相关，有文学性和趣味性
4. 三个分支结局要风格各异（浪漫/逍遥/沉思）
5. 文本要有诗意、有画面感
6. panoramaUrl 保持占位符不变，后续会替换为生成的图片
7. 确保所有 ID 引用一致（hotspot.storyId 对应 stories 的 key，choice.endingId 对应 endings 的 key，choice.nextNodeId 对应 nodes 的 id）
8. imagePrompts 中每个提示词必须是英文，用于AI生图，要描述具体的视觉画面，包含风格和氛围`;

export async function generateFullGameConfig(poemLine: string): Promise<PanoramaGameConfig> {
  const config = loadAiConfig();
  const { endpoint, apiKey, model, maxTokens } = config.llm!;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const userMsg = `你必须使用这句诗作为游戏的核心诗句（poem.line字段必须是这句原诗）：\n\n"${poemLine}"\n\n请严格按照 system prompt 中的 JSON 格式返回完整游戏配置，不要有任何额外文字。`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: 'system', content: FULL_GAME_SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM 生成失败: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? '';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM 未返回有效 JSON，请重试');

  const parsed = JSON.parse(jsonMatch[0]) as PanoramaGameConfig;

  if (!parsed.nodes?.length || !parsed.stories || !Object.keys(parsed.endings ?? {}).length || !parsed.puzzles || !Object.keys(parsed.puzzles).length) {
    throw new Error('LLM 返回的配置不完整，缺少必要字段');
  }

  repairConfig(parsed, poemLine);
  return parsed;
}

function repairConfig(cfg: PanoramaGameConfig, poemLine: string): void {
  if (!cfg.poem) cfg.poem = { poet: '李白', line: poemLine, source: '' };
  if (cfg.poem.line !== poemLine) cfg.poem.line = poemLine;

  cfg.nodes = cfg.nodes.map((node, index) => ({
    ...node,
    id: node.id || (index === 0 ? 'main_scene' : `branch_${index}`),
    type: 'panorama',
    title: node.title || (index === 0 ? '入梦之境' : `分支梦境 ${index}`),
    panoramaUrl: node.panoramaUrl || (index === 0 ? '__PLACEHOLDER_MAIN__' : `__PLACEHOLDER_BRANCH_${String.fromCharCode(64 + index)}__`),
    initialView: node.initialView ?? { yaw: 0, pitch: 0, fov: 104 },
    hotspots: node.hotspots ?? [],
  }));

  if (!cfg.puzzleOrder && cfg.puzzles) {
    cfg.puzzleOrder = Object.keys(cfg.puzzles);
  }
  if (cfg.puzzles) {
    const puzzleIds = Object.keys(cfg.puzzles);
    const orderedIds = (cfg.puzzleOrder ?? []).filter((id) => id in cfg.puzzles!);
    cfg.puzzleOrder = [...orderedIds, ...puzzleIds.filter((id) => !orderedIds.includes(id))];
  }

  if (!cfg.stories['story_gate'] || cfg.stories['story_gate'].choices.length === 0) {
    const firstStory = Object.values(cfg.stories).find((s) => s.choices && s.choices.length > 0);
    cfg.stories['story_gate'] = {
      id: 'story_gate',
      speaker: '星河诗阵',
      text: cfg.stories['story_gate']?.text ?? '三枚诗意碎片汇聚，星河诗阵缓缓开启，命运的分支在你面前展开。',
      choices: firstStory?.choices ?? buildFallbackChoices(cfg),
    };
  }

  const nodeIds = new Set(cfg.nodes.map((n) => n.id));
  if (!cfg.startNodeId || !nodeIds.has(cfg.startNodeId)) {
    cfg.startNodeId = cfg.nodes[0]?.id ?? 'main_scene';
  }

  for (const node of cfg.nodes) {
    for (const hotspot of node.hotspots) {
      if (!cfg.stories[hotspot.storyId]) {
        cfg.stories[hotspot.storyId] = {
          id: hotspot.storyId,
          speaker: '梦境',
          text: `触碰「${hotspot.label}」时，梦境泛起微光。继续收集诗意碎片，真正的分支会在星河诗阵中打开。`,
          choices: [],
        };
      }
    }
  }
}

function buildFallbackChoices(cfg: PanoramaGameConfig) {
  const branchIds = cfg.nodes.filter((node) => node.id !== cfg.startNodeId).map((node) => node.id);
  const endingIds = Object.keys(cfg.endings);
  const labels = ['循光入梦', '乘风远行', '回望诗心'];
  const tones = ['浪漫', '逍遥', '沉思'];

  return labels.map((label, index) => ({
    id: `choice_${index + 1}`,
    text: label,
    tone: tones[index],
    nextNodeId: branchIds[index] ?? branchIds[0] ?? cfg.startNodeId,
    endingId: endingIds[index] ?? endingIds[0] ?? 'ending_a',
  }));
}
