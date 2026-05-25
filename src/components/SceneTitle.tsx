import { Mountain } from 'lucide-react';
import type { PanoramaNode } from '../types/game';

interface SceneTitleProps {
  node: PanoramaNode;
}

export function SceneTitle({ node }: SceneTitleProps) {
  return (
    <div className="scene-title">
      <Mountain size={18} />
      <div>
        <strong>{node.title}</strong>
        <span>{node.subtitle}</span>
      </div>
    </div>
  );
}
