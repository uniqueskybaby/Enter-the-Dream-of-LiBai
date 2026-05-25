import type { PanoramaNode } from '../types/game';

interface DialogueStripProps {
  node: PanoramaNode;
}

export function DialogueStrip({ node }: DialogueStripProps) {
  return (
    <div className="dialogue-strip">
      <img src="/assets/ui/libai-avatar.jpg" alt="李白" />
      <div>
        <strong>李白</strong>
        <p>{node.ambientLine}</p>
      </div>
    </div>
  );
}
