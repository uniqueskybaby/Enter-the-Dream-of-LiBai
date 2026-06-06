import { BookOpen, CircleHelp, Gem, Moon, ScrollText, Settings } from 'lucide-react';
import { publicAssetUrl } from '../lib/config';
import type { PoemMeta, PlayerResources } from '../types/game';
import type { PanelKind } from './InfoPanel';

interface HudTopBarProps {
  poem: PoemMeta;
  onOpenPanel: (kind: PanelKind) => void;
  resources?: PlayerResources;
}

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}

const LIBAI_AVATAR_URL = publicAssetUrl('/assets/ui/libai-avatar.jpg');

export function HudTopBar({ poem, onOpenPanel, resources }: HudTopBarProps) {
  const ml = resources ? formatNum(resources.moonlight) : '—';
  const sc = resources ? formatNum(resources.scroll) : '—';
  const gm = resources ? String(resources.gem) : '—';

  return (
    <header className="play-hud">
      <div className="play-hud__brand">
        <img src={LIBAI_AVATAR_URL} alt="李白" />
        <div>
          <strong>青莲居士</strong>
          <span>{poem.source}</span>
        </div>
      </div>

      <div className="resource-row resource-row--play" aria-label="资源">
        <span><Moon size={17} />{ml}</span>
        <span><ScrollText size={17} />{sc}</span>
        <span><Gem size={17} />{gm}</span>
      </div>

      <nav className="round-actions round-actions--play" aria-label="功能">
        <button title="图鉴" onClick={() => onOpenPanel('atlas')}><BookOpen size={21} /><span>图鉴</span></button>
        <button title="指南" onClick={() => onOpenPanel('guide')}><CircleHelp size={21} /><span>指南</span></button>
        <button title="设置" onClick={() => onOpenPanel('settings')}><Settings size={21} /><span>设置</span></button>
      </nav>
    </header>
  );
}
