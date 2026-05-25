import type { Achievement, AchievementId, RewardPayload } from '../types/game';

const STORAGE_KEY = 'dream-li-bai-achievements';

export const achievements: Achievement[] = [
  { id: 'first_dream', name: '初入梦境', description: '首次完成一局游戏', reward: { moonlight: 500, gem: 2 } },
  { id: 'all_clues', name: '诗意满盈', description: '收集全部 3 枚碎片', reward: { moonlight: 300, scroll: 50 } },
  { id: 'first_puzzle', name: '月下三分', description: '解开月影问路', reward: { moonlight: 200 } },
  { id: 'all_endings', name: '万象通明', description: '解锁全部 3 个结局', reward: { gem: 10 } },
  { id: 'ai_draft', name: '梦中再梦', description: '使用 AI 创作台生成草稿', reward: { scroll: 100 } },
  { id: 'hidden_found', name: '探幽入微', description: '发现隐藏热点', reward: { moonlight: 200, gem: 1 } },
  { id: 'speed_run', name: '速梦者', description: '3 分钟内通关', reward: { gem: 5, moonlight: 1000 } },
  { id: 'poetry_duel', name: '梦中与李白对诗', description: '结局后应李白之邀写下一句诗', reward: { moonlight: 600, scroll: 120, gem: 3 } },
];

export function loadUnlockedAchievements(): AchievementId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AchievementId[];
  } catch { /* ignore */ }
  return [];
}

export function saveUnlockedAchievements(ids: AchievementId[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function tryUnlock(
  id: AchievementId,
  unlocked: AchievementId[],
): { newUnlocked: AchievementId[]; reward: RewardPayload } | null {
  if (unlocked.includes(id)) return null;
  const achievement = achievements.find((a) => a.id === id);
  if (!achievement) return null;
  const newUnlocked = [...unlocked, id];
  saveUnlockedAchievements(newUnlocked);
  return { newUnlocked, reward: achievement.reward };
}

export function getAchievement(id: AchievementId): Achievement | undefined {
  return achievements.find((a) => a.id === id);
}
