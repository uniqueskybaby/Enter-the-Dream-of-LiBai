import { BookOpen, CircleHelp, Gem, Home, Moon, Package, Settings, Sparkles } from 'lucide-react';
import type { PanelKind } from './InfoPanel';

interface BottomNavProps {
  onOpenPanel: (kind: PanelKind) => void;
  onOpenGate: () => void;
}

export function BottomNav({ onOpenPanel, onOpenGate }: BottomNavProps) {
  return (
    <nav className="bottom-nav bottom-nav--play" aria-label="梦境工具">
      <button onClick={() => onOpenPanel('atlas')}><Home size={25} /><span>图鉴</span></button>
      <button onClick={() => onOpenPanel('notes')}><BookOpen size={25} /><span>笔记</span></button>
      <button onClick={() => onOpenPanel('encounter')}><Sparkles size={25} /><span>奇遇</span></button>
      <button className="is-active" onClick={onOpenGate}><Moon size={30} /><span>入梦</span></button>
      <button onClick={() => onOpenPanel('guide')}><CircleHelp size={25} /><span>指南</span></button>
      <button onClick={() => onOpenPanel('bag')}><Package size={25} /><span>行囊</span></button>
      <button onClick={() => onOpenPanel('collection')}><Gem size={25} /><span>珍藏</span></button>
      <button onClick={() => onOpenPanel('ranking')}><Settings size={25} /><span>排行</span></button>
    </nav>
  );
}
