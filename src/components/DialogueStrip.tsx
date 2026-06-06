import { publicAssetUrl } from '../lib/config';
import type { PanoramaNode } from '../types/game';

interface DialogueStripProps {
  node: PanoramaNode;
}

const LIBAI_AVATAR_URL = publicAssetUrl('/assets/ui/libai-avatar.jpg');

export function DialogueStrip({ node }: DialogueStripProps) {
  return (
    <div className="dialogue-strip">
      <img src={LIBAI_AVATAR_URL} alt="李白" />
      <div>
        <strong>李白</strong>
        <p>{node.ambientLine}</p>
      </div>
    </div>
  );
}
