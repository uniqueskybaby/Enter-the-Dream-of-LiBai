export type PuzzleKind = 'choice' | 'sequence';

export interface DreamPuzzle {
  id: string;
  title: string;
  motif: string;
  speaker: string;
  prompt: string;
  clueName: string;
  clueText: string;
  kind: PuzzleKind;
  options: string[];
  answer: string[];
  hint: string;
  rewardLine: string;
}

export const dreamPuzzles: Record<DreamPuzzle['id'], DreamPuzzle> = {
  moon: {
    id: 'moon',
    title: '月影问路',
    motif: '月',
    speaker: '清月',
    prompt: '月光垂成银路，却只回应真正属于《望庐山瀑布》的那一句。选出能开启酒盏封印的诗句。',
    clueName: '月魄',
    clueText: '月光可化为道路，照见“疑是银河落九天”。',
    kind: 'choice',
    options: ['床前明月光', '疑是银河落九天', '举杯邀明月'],
    answer: ['疑是银河落九天'],
    hint: '这首诗里没有直写月，月藏在“银河”里。',
    rewardLine: '月魄归位，酒盏的封印松动了。',
  },
  wine: {
    id: 'wine',
    title: '杯中三影',
    motif: '酒',
    speaker: '酒盏',
    prompt: '杯中浮出三道影：诗人、月影、我影。哪一道影能把玩家带入李白的梦，而不只是旁观？',
    clueName: '酒筹',
    clueText: '酒杯映出山河，也映出入梦者自己的选择。',
    kind: 'choice',
    options: ['诗人', '月影', '我影'],
    answer: ['我影'],
    hint: '李白已经在梦里，真正需要被确认的是你。',
    rewardLine: '酒筹落定，瀑声里出现了断开的诗句。',
  },
  waterfall: {
    id: 'waterfall',
    title: '瀑声断句',
    motif: '瀑布',
    speaker: '银河瀑布',
    prompt: '瀑声把诗句冲散了。按正确顺序点亮碎片，让银河重新落回庐山。',
    clueName: '瀑印',
    clueText: '飞流直下三千尺，疑是银河落九天。',
    kind: 'sequence',
    options: ['银河', '飞流', '落九天', '疑是', '三千尺', '直下'],
    answer: ['飞流', '直下', '三千尺', '疑是', '银河', '落九天'],
    hint: '先写瀑布的势，再写银河的幻。',
    rewardLine: '瀑印成形，星河诗阵已经可以开启。',
  },
};

export const puzzleOrder: DreamPuzzle['id'][] = ['moon', 'wine', 'waterfall'];

import type { DynamicPuzzle } from '../types/game';

export function dynamicPuzzleToDreamPuzzle(dp: DynamicPuzzle): DreamPuzzle {
  return {
    id: dp.id,
    title: dp.clueName,
    motif: dp.motif,
    speaker: '梦境',
    prompt: dp.question,
    clueName: dp.clueName,
    clueText: dp.clueText,
    kind: 'choice',
    options: dp.options,
    answer: [dp.options[dp.correctIndex]],
    hint: dp.hint,
    rewardLine: dp.rewardLine,
  };
}

export function buildPuzzleMap(config: { puzzles?: Record<string, DynamicPuzzle>; puzzleOrder?: string[] }): Record<string, DreamPuzzle> {
  if (!config.puzzles) return dreamPuzzles;
  const result: Record<string, DreamPuzzle> = {};
  for (const [key, dp] of Object.entries(config.puzzles)) {
    result[key] = dynamicPuzzleToDreamPuzzle(dp);
  }
  return result;
}

export interface HiddenHotspotDef {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  triggerRadius: number;
  dwellMs: number;
  speaker: string;
  dialogue: string;
  reward: { moonlight?: number; scroll?: number; gem?: number };
}

export const hiddenHotspots: HiddenHotspotDef[] = [
  {
    id: 'hidden_pine',
    label: '孤松听风',
    yaw: 150,
    pitch: -5,
    triggerRadius: 15,
    dwellMs: 2000,
    speaker: '孤松',
    dialogue: '松涛如歌，李白曾在此驻足听风。你感到一阵清凉的诗意涌来。',
    reward: { moonlight: 100 },
  },
  {
    id: 'hidden_stone',
    label: '石刻诗痕',
    yaw: -120,
    pitch: 25,
    triggerRadius: 15,
    dwellMs: 2000,
    speaker: '石壁',
    dialogue: '岩壁上隐约可见古人题刻："天生我材必有用"——墨迹犹新。',
    reward: { scroll: 50 },
  },
];
