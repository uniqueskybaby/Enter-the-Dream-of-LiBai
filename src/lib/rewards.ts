import { createContext, useContext } from 'react';
import type { PlayerResources, RewardPayload } from '../types/game';

const STORAGE_KEY = 'dream-li-bai-resources';
const DAILY_KEY = 'dream-li-bai-daily';

const defaultResources: PlayerResources = { moonlight: 1000, scroll: 100, gem: 5 };

export function loadResources(): PlayerResources {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PlayerResources;
  } catch { /* ignore */ }
  return { ...defaultResources };
}

export function saveResources(resources: PlayerResources): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resources));
}

export function applyReward(current: PlayerResources, reward: RewardPayload): PlayerResources {
  return {
    moonlight: current.moonlight + (reward.moonlight ?? 0),
    scroll: current.scroll + (reward.scroll ?? 0),
    gem: current.gem + (reward.gem ?? 0),
  };
}

export function canAfford(current: PlayerResources, cost: RewardPayload): boolean {
  if ((cost.moonlight ?? 0) > current.moonlight) return false;
  if ((cost.scroll ?? 0) > current.scroll) return false;
  if ((cost.gem ?? 0) > current.gem) return false;
  return true;
}

export function spendResources(current: PlayerResources, cost: RewardPayload): PlayerResources {
  return {
    moonlight: current.moonlight - (cost.moonlight ?? 0),
    scroll: current.scroll - (cost.scroll ?? 0),
    gem: current.gem - (cost.gem ?? 0),
  };
}

export function checkDailyBonus(): boolean {
  const today = new Date().toDateString();
  const last = localStorage.getItem(DAILY_KEY);
  return last !== today;
}

export function claimDailyBonus(): RewardPayload {
  localStorage.setItem(DAILY_KEY, new Date().toDateString());
  return { moonlight: 300, scroll: 30 };
}

export const REWARDS = {
  puzzleSolved: { moonlight: 500, scroll: 50 } as RewardPayload,
  clueCollected: { moonlight: 200, gem: 1 } as RewardPayload,
  endingReached: { moonlight: 1000, scroll: 100, gem: 5 } as RewardPayload,
  endingRare: { moonlight: 2000, scroll: 200, gem: 10 } as RewardPayload,
  hiddenFound: { moonlight: 100 } as RewardPayload,
  dailyBonus: { moonlight: 300, scroll: 30 } as RewardPayload,
};

export interface ResourceContextValue {
  resources: PlayerResources;
  grant: (reward: RewardPayload) => void;
  spend: (cost: RewardPayload) => boolean;
}

export const ResourceContext = createContext<ResourceContextValue>({
  resources: defaultResources,
  grant: () => {},
  spend: () => false,
});

export function useResources() {
  return useContext(ResourceContext);
}
