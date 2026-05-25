import { BookOpen, Feather, Package } from 'lucide-react';
import type { PanoramaNode } from '../types/game';

interface SideJournalProps {
  node: PanoramaNode;
  clueCount: number;
}

export function SideJournal({ node, clueCount }: SideJournalProps) {
  return (
    <aside className="side-journal">
      <div className="journal-card">
        <BookOpen size={26} />
        <span>诗意碎片</span>
        <strong>{clueCount}/3</strong>
      </div>
      <div className="journal-card">
        <Feather size={26} />
        <span>已解诗句</span>
        <strong>{node.hotspots.some((hotspot) => hotspot.id === 'moon') ? '3/9' : '4/9'}</strong>
      </div>
      <div className="journal-card">
        <Package size={26} />
        <span>梦境能力</span>
      </div>
    </aside>
  );
}
