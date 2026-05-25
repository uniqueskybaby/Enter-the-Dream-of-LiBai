import { Moon, Sparkles } from 'lucide-react';
import type { EndingBlock, PanoramaNode, StoryChoice } from '../types/game';

interface BranchPanelProps {
  node: PanoramaNode;
  choice: StoryChoice;
  ending: EndingBlock;
  onFinish: () => void;
}

export function BranchPanel({ node, choice, ending, onFinish }: BranchPanelProps) {
  return (
    <aside className="branch-panel">
      <div className="branch-panel__crest"><Moon size={20} /></div>
      <p className="branch-panel__eyebrow">{choice.text}</p>
      <h2>{node.title}</h2>
      <p>{node.subtitle}</p>
      <button className="gold-button" onClick={onFinish}>
        <Sparkles size={20} />
        凝成结局
      </button>
      <small>{ending.rarity}</small>
    </aside>
  );
}
