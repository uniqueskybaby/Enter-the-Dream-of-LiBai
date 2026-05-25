import { Lock, Sparkles } from 'lucide-react';

interface GatePanelProps {
  ready: boolean;
  clueCount: number;
  onOpen: () => void;
}

export function GatePanel({ ready, clueCount, onOpen }: GatePanelProps) {
  return (
    <aside className={ready ? 'gate-panel is-ready' : 'gate-panel'}>
      <div>
        {ready ? <Sparkles size={24} /> : <Lock size={24} />}
        <span>星河诗阵</span>
        <strong>{clueCount}/3</strong>
      </div>
      <button className={ready ? 'gold-button' : 'glass-button'} onClick={onOpen}>
        {ready ? '开启分支选择' : '收集诗意碎片'}
      </button>
    </aside>
  );
}
