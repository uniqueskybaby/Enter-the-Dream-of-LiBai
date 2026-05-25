import {
  Bell,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Gem,
  Map,
  Moon,
  Package,
  Settings,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { AchievementId, DreamManifestEntry, PanoramaGameConfig, PlayerResources, RewardPayload } from '../types/game';
import { PLAYER_AI_DREAM_LABEL } from '../lib/config';
import { dreamPuzzles, puzzleOrder, hiddenHotspots, buildPuzzleMap } from '../lib/puzzles';
import { achievements } from '../lib/achievements';
import { loadAiConfig, saveAiConfig } from '../lib/ai/apiClient';
import { useState } from 'react';

export type PanelKind =
  | 'atlas'
  | 'settings'
  | 'announcements'
  | 'library'
  | 'encounter'
  | 'ranking'
  | 'guide'
  | 'notes'
  | 'bag'
  | 'collection';

interface InfoPanelProps {
  kind: PanelKind;
  config: PanoramaGameConfig;
  dreams?: DreamManifestEntry[];
  activeGameId?: string;
  clues: string[];
  soundEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  onToggleSound: () => void;
  onMusicVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
  onClose: () => void;
  onOpenAi: () => void;
  onSelectDream?: (gameId: string) => void;
  resources?: PlayerResources;
  unlockedAchievements?: AchievementId[];
  foundHiddenIds?: string[];
  onSpend?: (cost: RewardPayload) => boolean;
}

const titles: Record<PanelKind, string> = {
  atlas: '梦境图鉴',
  settings: '设置',
  announcements: '公告',
  library: '诗库',
  encounter: '奇遇',
  ranking: '排行榜',
  guide: '游戏指南',
  notes: '诗句笔记',
  bag: '行囊',
  collection: '珍藏',
};

function isPlayerAiDream(dream: DreamManifestEntry): boolean {
  return dream.origin === 'player-ai' || dream.theme === PLAYER_AI_DREAM_LABEL || dream.gameId.startsWith('dream_generated');
}

export function InfoPanel({
  kind,
  config,
  dreams = [],
  activeGameId,
  clues,
  soundEnabled,
  musicVolume,
  sfxVolume,
  onToggleSound,
  onMusicVolumeChange,
  onSfxVolumeChange,
  onClose,
  onOpenAi,
  onSelectDream,
  resources,
  unlockedAchievements = [],
  foundHiddenIds = [],
  onSpend,
}: InfoPanelProps) {
  return (
    <div className="modal-scrim" role="presentation">
      <section className="info-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <button className="icon-button story-modal__close" onClick={onClose} aria-label="关闭">×</button>
        <header className="info-panel__head">
          {iconFor(kind)}
          <div>
            <small>{config.world.worldName}</small>
            <h2 id="panel-title">{titles[kind]}</h2>
          </div>
        </header>
        {renderPanelBody(kind, config, dreams, activeGameId, clues, soundEnabled, musicVolume, sfxVolume, onToggleSound, onMusicVolumeChange, onSfxVolumeChange, onOpenAi, onSelectDream, resources, unlockedAchievements, foundHiddenIds, onSpend)}
      </section>
    </div>
  );
}

function iconFor(kind: PanelKind) {
  const iconProps = { size: 28 };
  const map: Record<PanelKind, ReactNode> = {
    atlas: <BookOpen {...iconProps} />,
    settings: <Settings {...iconProps} />,
    announcements: <Bell {...iconProps} />,
    library: <BookOpen {...iconProps} />,
    encounter: <Sparkles {...iconProps} />,
    ranking: <Trophy {...iconProps} />,
    guide: <CircleHelp {...iconProps} />,
    notes: <Moon {...iconProps} />,
    bag: <Package {...iconProps} />,
    collection: <Gem {...iconProps} />,
  };
  return map[kind];
}

function renderPanelBody(
  kind: PanelKind,
  config: PanoramaGameConfig,
  dreams: DreamManifestEntry[] = [],
  activeGameId: string | undefined,
  clues: string[],
  soundEnabled: boolean,
  musicVolume: number,
  sfxVolume: number,
  onToggleSound: () => void,
  onMusicVolumeChange: (volume: number) => void,
  onSfxVolumeChange: (volume: number) => void,
  onOpenAi: () => void,
  onSelectDream?: (gameId: string) => void,
  resources?: PlayerResources,
  unlockedAchievements: AchievementId[] = [],
  foundHiddenIds: string[] = [],
  onSpend?: (cost: RewardPayload) => boolean,
) {
  if (kind === 'settings') {
    return (
      <SettingsPanel
        soundEnabled={soundEnabled}
        musicVolume={musicVolume}
        sfxVolume={sfxVolume}
        onToggleSound={onToggleSound}
        onMusicVolumeChange={onMusicVolumeChange}
        onSfxVolumeChange={onSfxVolumeChange}
        onOpenAi={onOpenAi}
      />
    );
  }

  if (kind === 'guide') {
    return (
      <div className="panel-list guide-panel">
        <article className="is-active">
          <Map size={22} />
          <div>
            <strong>一局目标</strong>
            <p>选择一首诗进入主梦境，找到 3 个发光意象，解开诗意碎片后开启分支选择。</p>
          </div>
        </article>
        <article>
          <Sparkles size={22} />
          <div>
            <strong>探索方式</strong>
            <p>拖拽或用方向键环顾全景；数字 1/2/3 可转向热点，空格或 E 可交互，Esc 关闭弹窗。</p>
          </div>
        </article>
        <article>
          <Package size={22} />
          <div>
            <strong>资源用途</strong>
            <p>月光、诗卷、宝石会通过每日入梦、谜题、隐藏热点和结局获得，可在行囊里消耗。</p>
          </div>
        </article>
        <article>
          <BookOpen size={22} />
          <div>
            <strong>结算与收藏</strong>
            <p>一局结束后可保存结局进入珍藏，也可以再入一梦或返回主页切换新的诗境。</p>
          </div>
        </article>
      </div>
    );
  }

  if (kind === 'atlas') {
    return (
      <>
        {dreams.length > 0 && (
          <div className="panel-list panel-list--buttons atlas-dream-list">
            {dreams.map((dream) => (
              <button
                key={dream.gameId}
                className={dream.gameId === (activeGameId ?? config.gameId) ? 'is-active' : ''}
                onClick={() => onSelectDream?.(dream.gameId)}
              >
                <BookOpen size={22} />
                <div>
                  <strong>{dream.source}</strong>
                  <p>{dream.worldName}</p>
                  <small>
                    {isPlayerAiDream(dream) ? PLAYER_AI_DREAM_LABEL : dream.theme}
                    {' · '}
                    {dream.poemLine}
                  </small>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="panel-list atlas-node-list">
          {config.nodes.map((node) => (
            <article key={node.id}>
              <CheckCircle2 size={22} />
              <div>
                <strong>{node.title}</strong>
                <p>{node.subtitle ?? node.ambientLine}</p>
              </div>
            </article>
          ))}
          <article>
            <Sparkles size={22} />
            <div>
              <strong>已发现热点</strong>
              <p>{config.nodes.reduce((sum, n) => sum + n.hotspots.length, 0)} 个场景热点 · {foundHiddenIds.length} 个隐藏热点</p>
            </div>
          </article>
        </div>
      </>
    );
  }

  if (kind === 'notes') {
    const activePuzzles = config.puzzles ? buildPuzzleMap(config) : dreamPuzzles;
    const activeOrder = config.puzzleOrder ?? puzzleOrder;

    return (
      <div className="panel-list">
        {activeOrder.map((id) => {
          const puzzle = activePuzzles[id];
          if (!puzzle) return null;
          const active = clues.includes(id);
          return (
            <article key={id} className={active ? 'is-active' : ''}>
              <span className="panel-token">{puzzle.motif}</span>
              <div>
                <strong>{active ? puzzle.clueName : '未获得碎片'}</strong>
                <p>{active ? puzzle.clueText : puzzle.hint}</p>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  if (kind === 'bag') {
    return (
      <div className="bag-panel">
        <div className="bag-panel__resources">
          <div><strong>{resources?.moonlight ?? 0}</strong><small>月光</small></div>
          <div><strong>{resources?.scroll ?? 0}</strong><small>诗卷</small></div>
          <div><strong>{resources?.gem ?? 0}</strong><small>宝石</small></div>
        </div>
        <h3 style={{ fontSize: '0.9rem', opacity: 0.7, margin: '8px 0 4px' }}>道具</h3>
        <div className="bag-panel__items">
          <button onClick={() => onSpend?.({ moonlight: 200 })} disabled={!resources || resources.moonlight < 200}>
            <span>诗仙指引</span>
            <small>200 月光 · 自动转向最近未解锁热点</small>
          </button>
          <button onClick={() => onSpend?.({ gem: 1 })} disabled={!resources || resources.gem < 1}>
            <span>灵感之光</span>
            <small>1 宝石 · 谜题中高亮正确选项 3 秒</small>
          </button>
          <button disabled>
            <span>时光回溯</span>
            <small>免费 · 每局 1 次 · 重做当前谜题</small>
          </button>
        </div>
        <h3 style={{ fontSize: '0.9rem', opacity: 0.7, margin: '8px 0 4px' }}>成就 ({unlockedAchievements.length}/{achievements.length})</h3>
        <div className="panel-list">
          {achievements.map((ach) => {
            const unlocked = unlockedAchievements.includes(ach.id);
            return (
              <article key={ach.id} className={unlocked ? 'is-active' : ''}>
                <Trophy size={18} />
                <div>
                  <strong>{ach.name}</strong>
                  <p>{unlocked ? ach.description : '???'}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  if (kind === 'collection') {
    const savedResults = JSON.parse(localStorage.getItem('dream-li-bai-results') ?? '[]') as string[];
    const allEndings = Object.values(config.endings);
    return (
      <div className="collection-panel__grid">
        {allEndings.map((ending) => {
          const unlocked = savedResults.includes(ending.id);
          return (
            <div key={ending.id} className={`collection-card ${unlocked ? '' : 'is-locked'}`}>
              <strong>{unlocked ? ending.name : '???'}</strong>
              <small>{unlocked ? ending.rarity : '未解锁'}</small>
            </div>
          );
        })}
      </div>
    );
  }

  if (kind === 'encounter') {
    const activeHiddenHotspots = config.hiddenHotspots ?? hiddenHotspots;

    return (
      <div className="encounter-panel__list">
        {activeHiddenHotspots.map((h) => {
          const found = foundHiddenIds.includes(h.id);
          return (
            <div key={h.id} className={`encounter-item ${found ? 'is-found' : ''}`}>
              <div className="encounter-item__icon">{found ? '✦' : '?'}</div>
              <div className="encounter-item__info">
                <strong>{found ? h.label : '未知奇遇'}</strong>
                <small>{found ? h.dialogue : '探索梦境，注视远方...'}</small>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (kind === 'ranking') {
    const savedResults = JSON.parse(localStorage.getItem('dream-li-bai-results') ?? '[]') as string[];
    const activePuzzleTotal = (config.puzzleOrder ?? puzzleOrder).length;
    const activeHiddenTotal = (config.hiddenHotspots ?? hiddenHotspots).length;
    return (
      <div className="panel-list">
        <article className="is-active">
          <Trophy size={22} />
          <div>
            <strong>通关记录</strong>
            <p>已解锁 {savedResults.length} 个结局</p>
          </div>
        </article>
        <article>
          <Moon size={22} />
          <div>
            <strong>碎片收集</strong>
            <p>当前 {clues.length}/{activePuzzleTotal} 枚诗意碎片</p>
          </div>
        </article>
        <article>
          <Sparkles size={22} />
          <div>
            <strong>隐藏发现</strong>
            <p>{foundHiddenIds.length}/{activeHiddenTotal} 个隐藏热点</p>
          </div>
        </article>
        <article>
          <Gem size={22} />
          <div>
            <strong>成就进度</strong>
            <p>{unlockedAchievements.length}/{achievements.length} 个成就已解锁</p>
          </div>
        </article>
      </div>
    );
  }

  if (kind === 'announcements') {
    return (
      <div className="panel-copy">
        <p>本次梦境更新：资源与奖励系统、成就系统、隐藏热点探索、AI 模型接口、丰富快捷键操作。</p>
        <p>下一步计划：接入服务端模型生成、更多诗人梦境、瀑布雾气与星光粒子。</p>
      </div>
    );
  }

  if (kind === 'library') {
    const libraryDreams = dreams.length > 0 ? dreams : [{
      gameId: config.gameId,
      title: config.title,
      poemLine: config.poem.line,
      source: config.poem.source,
      worldName: config.world.worldName,
      configUrl: '',
      coverUrl: config.nodes[0]?.panoramaUrl ?? '',
      theme: config.world.visualTone,
    }];

    return (
      <div className="panel-list panel-list--buttons">
        {libraryDreams.map((dream) => (
          <button
            key={dream.gameId}
            className={dream.gameId === (activeGameId ?? config.gameId) ? 'is-active' : ''}
            onClick={() => onSelectDream?.(dream.gameId)}
          >
            <BookOpen size={22} />
            <div>
              <strong>{dream.source}</strong>
              <p>{dream.poemLine}</p>
              <small>{dream.worldName} · {isPlayerAiDream(dream) ? PLAYER_AI_DREAM_LABEL : dream.theme}</small>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return <div className="panel-copy"><p>已保存的结局会出现在这里。本地 Demo 会把保存记录写入浏览器存档。</p></div>;
}

function SettingsPanel({
  soundEnabled,
  musicVolume,
  sfxVolume,
  onToggleSound,
  onMusicVolumeChange,
  onSfxVolumeChange,
  onOpenAi,
}: {
  soundEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  onToggleSound: () => void;
  onMusicVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
  onOpenAi: () => void;
}) {
  const [aiConfig, setAiConfig] = useState(() => loadAiConfig());

  const updateField = (section: 'imageGeneration' | 'llm', field: string, value: string | number) => {
    const next = { ...aiConfig, [section]: { ...aiConfig[section]!, [field]: value } };
    setAiConfig(next);
    saveAiConfig(next);
  };

  return (
    <div>
      <div className="panel-grid">
        <button className="panel-action" onClick={onToggleSound}>
          {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          <span>声音</span>
          <strong>{soundEnabled ? '已开启' : '已静音'}</strong>
        </button>
        <button className="panel-action" onClick={onOpenAi}>
          <Sparkles size={24} />
          <span>AI 创作台</span>
          <strong>生成诗境草稿</strong>
        </button>
      </div>
      <div className="audio-settings">
        <label>
          <span>
            音乐音量
            <strong>{Math.round(musicVolume * 100)}%</strong>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(event) => onMusicVolumeChange(Number(event.target.value))}
          />
        </label>
        <label>
          <span>
            音效音量
            <strong>{Math.round(sfxVolume * 100)}%</strong>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sfxVolume}
            onChange={(event) => onSfxVolumeChange(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="ai-settings">
        <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--gold)' }}>AI 模型配置</h4>
        <label>
          LLM Endpoint
          <input value={aiConfig.llm?.endpoint ?? ''} onChange={(e) => updateField('llm', 'endpoint', e.target.value)} placeholder="https://api.xiaomimimo.com/v1/chat/completions" />
        </label>
        <label>
          LLM API Key
          <input type="password" value={aiConfig.llm?.apiKey ?? ''} onChange={(e) => updateField('llm', 'apiKey', e.target.value)} placeholder="sk-..." />
        </label>
        <label>
          LLM Model
          <input value={aiConfig.llm?.model ?? ''} onChange={(e) => updateField('llm', 'model', e.target.value)} placeholder="MiMo-V2.5" />
        </label>
        <label>
          LLM 上下文 Token 上限
          <input
            type="number"
            min={1024}
            max={65536}
            step={1024}
            value={aiConfig.llm?.maxTokens ?? ''}
            onChange={(e) => updateField('llm', 'maxTokens', Number(e.target.value))}
            placeholder="32768"
          />
        </label>
        <label>
          生图 Endpoint
          <input value={aiConfig.imageGeneration?.endpoint ?? ''} onChange={(e) => updateField('imageGeneration', 'endpoint', e.target.value)} placeholder="https://www.codexapis.com/v1/images/generations" />
        </label>
        <label>
          生图 API Key
          <input type="password" value={aiConfig.imageGeneration?.apiKey ?? ''} onChange={(e) => updateField('imageGeneration', 'apiKey', e.target.value)} placeholder="sk-..." />
        </label>
        <label>
          生图 Model
          <input value={aiConfig.imageGeneration?.model ?? ''} onChange={(e) => updateField('imageGeneration', 'model', e.target.value)} placeholder="gpt-image-2" />
        </label>
        <small style={{ opacity: 0.5 }}>配置后 AI 创作台将调用真实模型。也可通过 VITE_AI_PROXY_URL 环境变量配置代理。</small>
      </div>
    </div>
  );
}
