export type HotspotState = 'available' | 'locked' | 'hidden';

export interface ViewState {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface PoemMeta {
  poet: string;
  line: string;
  source: string;
}

export interface WorldMeta {
  worldName: string;
  visualTone: string;
  spaceRules: string[];
}

export interface HotspotConfig {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  radius?: number;
  state: HotspotState;
  storyId: string;
  icon?: string;
  effect?: string;
}

export interface PanoramaNode {
  id: string;
  type: 'panorama';
  title: string;
  subtitle?: string;
  panoramaUrl: string;
  initialView: ViewState;
  ambientLine?: string;
  hotspots: HotspotConfig[];
}

export interface StoryChoice {
  id: string;
  text: string;
  tone: string;
  nextNodeId: string;
  endingId: string;
}

export interface StoryBlock {
  id: string;
  speaker: string;
  text: string;
  choices: StoryChoice[];
}

export interface EndingBlock {
  id: string;
  name: string;
  rarity: string;
  text: string;
  rewardTitle: string;
  rewardText: string;
  imageUrl?: string;
}

export interface PanoramaGameConfig {
  gameId: string;
  title: string;
  poem: PoemMeta;
  world: WorldMeta;
  startNodeId: string;
  nodes: PanoramaNode[];
  stories: Record<string, StoryBlock>;
  endings: Record<string, EndingBlock>;
  puzzles?: Record<string, DynamicPuzzle>;
  puzzleOrder?: string[];
  imagePrompts?: Record<string, string>;
  hiddenHotspots?: HiddenHotspot[];
  meta?: {
    origin?: 'built-in' | 'player-ai';
    savedAt?: string;
  };
}

export interface DynamicPuzzle {
  id: string;
  motif: string;
  clueName: string;
  clueText: string;
  hint: string;
  rewardLine: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface PlayerResources {
  moonlight: number;
  scroll: number;
  gem: number;
}

export interface RewardPayload {
  moonlight?: number;
  scroll?: number;
  gem?: number;
}

export type ItemId = 'poet_guide' | 'inspiration_light' | 'time_rewind';

export interface GameItem {
  id: ItemId;
  name: string;
  description: string;
  cost: RewardPayload;
  maxPerRun: number;
}

export type AchievementId =
  | 'first_dream'
  | 'all_clues'
  | 'first_puzzle'
  | 'all_endings'
  | 'ai_draft'
  | 'hidden_found'
  | 'speed_run'
  | 'poetry_duel';

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  reward: RewardPayload;
}

export interface HiddenHotspot {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  triggerRadius: number;
  dwellMs: number;
  speaker: string;
  dialogue: string;
  reward: RewardPayload;
}

export interface DreamManifestEntry {
  gameId: string;
  title: string;
  poemLine: string;
  source: string;
  worldName: string;
  configUrl: string;
  coverUrl: string;
  theme: string;
  origin?: 'built-in' | 'player-ai';
  savedAt?: string;
}

export interface AiApiConfig {
  imageGeneration: {
    endpoint: string;
    apiKey: string;
    model: string;
  };
  llm: {
    endpoint: string;
    apiKey: string;
    model: string;
    maxTokens: number;
  };
}
