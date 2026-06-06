import { useEffect, useState } from 'react';
import { BookOpen, CircleHelp, Gem, Map, Moon, Package, ScrollText, Settings, Sparkles } from 'lucide-react';
import { PLAYER_AI_DREAM_LABEL, publicAssetUrl } from '../lib/config';
import type { DreamManifestEntry, PanoramaGameConfig, PlayerResources } from '../types/game';
import type { PanelKind } from './InfoPanel';

interface HomeScreenProps {
  config: PanoramaGameConfig;
  dreams: DreamManifestEntry[];
  resources: PlayerResources;
  savedResultCount: number;
  achievementCount: number;
  onStart: () => void;
  onOpenPanel: (kind: PanelKind) => void;
  onOpenAi: () => void;
  onSelectDream: (gameId: string) => void;
}

function formatNum(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}

function isPlayerAiDream(dream: DreamManifestEntry): boolean {
  return dream.origin === 'player-ai' || dream.theme === PLAYER_AI_DREAM_LABEL || dream.gameId.startsWith('dream_generated');
}

const LIBAI_AVATAR_URL = publicAssetUrl('/assets/ui/libai-avatar.jpg');

export function HomeScreen({
  config,
  dreams,
  resources,
  savedResultCount,
  achievementCount,
  onStart,
  onOpenPanel,
  onOpenAi,
  onSelectDream,
}: HomeScreenProps) {
  const [loadDeferredThumbs, setLoadDeferredThumbs] = useState(false);
  const dreamPower = resources.moonlight + resources.scroll * 6 + resources.gem * 120 + savedResultCount * 280 + achievementCount * 160;
  const level = Math.max(1, Math.floor(dreamPower / 2400) + 1);
  const progress = dreamPower > 0 && dreamPower % 2400 === 0 ? 2400 : dreamPower % 2400;
  const activeDream = dreams.find((dream) => dream.gameId === config.gameId);
  const backdropUrl = activeDream?.coverUrl ?? config.nodes.find((node) => node.id === config.startNodeId)?.panoramaUrl ?? config.nodes[0]?.panoramaUrl;

  useEffect(() => {
    setLoadDeferredThumbs(false);
    const timer = window.setTimeout(() => setLoadDeferredThumbs(true), 1800);
    return () => window.clearTimeout(timer);
  }, [config.gameId, dreams.length]);

  return (
    <section className="home-screen">
      <div
        key={backdropUrl}
        className="home-screen__backdrop"
        style={backdropUrl ? { backgroundImage: `url(${backdropUrl})` } : undefined}
      />
      <div className="home-screen__shade" />

      <header className="home-topbar" aria-label="玩家信息">
        <div className="profile-crest">
          <img src={LIBAI_AVATAR_URL} alt="青莲居士" />
          <div>
            <strong>青莲居士</strong>
            <span>入梦值 {progress}/2400</span>
          </div>
          <b>{level}</b>
        </div>

        <div className="resource-row" aria-label="资源">
          <button title="打开行囊" onClick={() => onOpenPanel('bag')}><Moon size={18} />{formatNum(resources.moonlight)}</button>
          <button title="打开行囊" onClick={() => onOpenPanel('bag')}><ScrollText size={18} />{formatNum(resources.scroll)}</button>
          <button title="打开行囊" onClick={() => onOpenPanel('bag')}><Gem size={18} />{resources.gem}</button>
        </div>

        <nav className="round-actions" aria-label="功能">
          <button title="图鉴" onClick={() => onOpenPanel('atlas')}><BookOpen size={22} /><span>图鉴</span></button>
          <button title="指南" onClick={() => onOpenPanel('guide')}><CircleHelp size={22} /><span>指南</span></button>
          <button title="设置" onClick={() => onOpenPanel('settings')}><Settings size={22} /><span>设置</span></button>
        </nav>
      </header>

      <main className="home-hero">
        <div className="home-titlemark">
          <span>诗仙</span>
          <h1>入梦李白</h1>
          <p>{config.poem.line}</p>
        </div>

        <div className="poem-ribbon" aria-label={config.poem.source}>
          <span>{config.poem.source}</span>
          <p>{config.world.worldName}</p>
        </div>

        <div className="home-cta">
          <button className="gold-button gold-button--large" onClick={onStart}>
            <Sparkles size={24} />
            开始入梦
          </button>
          <button className="glass-button" onClick={onOpenAi}>
            <Map size={22} />
            AI 推荐诗句
          </button>
        </div>
      </main>

      {dreams.length > 1 && (
        <aside className="home-dreams" aria-label="诗境选择">
          {dreams.map((dream) => (
            <button
              key={dream.gameId}
              className={[
                dream.gameId === config.gameId ? 'is-active' : '',
                isPlayerAiDream(dream) ? 'is-player-ai' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDream(dream.gameId)}
              style={(dream.gameId === config.gameId || loadDeferredThumbs) ? { backgroundImage: `url(${dream.coverUrl})` } : undefined}
            >
              <span className={isPlayerAiDream(dream) ? 'dream-origin-badge' : undefined}>
                {isPlayerAiDream(dream) ? PLAYER_AI_DREAM_LABEL : dream.theme}
              </span>
              <strong>{dream.source}</strong>
              <small>{dream.poemLine}</small>
            </button>
          ))}
        </aside>
      )}

      <footer className="bottom-nav bottom-nav--home" aria-label="导航">
        <button onClick={() => onOpenPanel('atlas')}><BookOpen size={26} /><span>图鉴</span><small>{savedResultCount} 个结局</small></button>
        <button onClick={() => onOpenPanel('library')}><ScrollText size={26} /><span>诗库</span><small>{dreams.length} 首可玩</small></button>
        <a className="is-active"><Moon size={34} /><span>入梦</span></a>
        <button onClick={() => onOpenPanel('guide')}><CircleHelp size={26} /><span>指南</span><small>玩法说明</small></button>
        <button onClick={() => onOpenPanel('bag')}><Package size={26} /><span>行囊</span><small>{formatNum(resources.moonlight)} 月光</small></button>
      </footer>
    </section>
  );
}
