import { Sparkles } from 'lucide-react';

interface LoadingDreamProps {
  message?: string;
}

export function LoadingDream({ message = '梦境正在凝成' }: LoadingDreamProps) {
  return (
    <div className="loading-dream">
      <div className="loading-dream__moon">
        <Sparkles size={28} />
      </div>
      <div className="loading-dream__text">{message}</div>
      <div className="loading-dream__bar">
        <span />
      </div>
    </div>
  );
}
