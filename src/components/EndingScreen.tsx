import { BookOpen, Gem, Home, Moon, RotateCcw, Save, ScrollText, Share2, Sparkles, Trophy } from 'lucide-react';
import { PoetryDuelPanel, type PoetryDuelResult } from './PoetryDuelPanel';
import type { EndingBlock, PanoramaNode, PoemMeta, StoryChoice } from '../types/game';

interface EndingScreenProps {
  ending: EndingBlock;
  node: PanoramaNode;
  choice: StoryChoice;
  poem: PoemMeta;
  onRestart: () => void;
  onHome: () => void;
  onSave: () => void;
  onShare: () => void;
  onPoetryDuelComplete: (result: PoetryDuelResult) => void;
  saved: boolean;
  poetryDuelUnlocked: boolean;
}

const trail = ['入梦初醒', '诗意初现', '剑意初扬', '月下谪仙', '梦成归真'];

export function EndingScreen({
  ending,
  node,
  choice,
  poem,
  onRestart,
  onHome,
  onSave,
  onShare,
  onPoetryDuelComplete,
  saved,
  poetryDuelUnlocked,
}: EndingScreenProps) {
  const isRare = ['珍稀', '稀有', '传说'].some((word) => ending.rarity.includes(word));
  const moonReward = isRare ? 2000 : 1000;
  const scrollReward = isRare ? 200 : 100;
  const gemReward = isRare ? 10 : 5;
  const bgImage = ending.imageUrl || node.panoramaUrl;

  return (
    <section className="ending-screen">
      <div className="ending-screen__backdrop" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="ending-screen__shade" />

      <main className="ending-content">
        <div className="ending-copy">
          <p className="ending-copy__eyebrow">你在李白梦中成为了</p>
          <h1>{ending.name}</h1>
          <span className="rarity-badge">{ending.rarity}</span>
          <p>{ending.text}</p>

          <div className="reward-list">
            <div>
              <BookOpen size={28} />
              <span>{ending.rewardTitle}</span>
              <strong>{ending.rewardText}</strong>
            </div>
            <div>
              <Trophy size={28} />
              <span>本梦收获</span>
              <strong>诗意碎片 +3</strong>
            </div>
            <div>
              <Moon size={28} />
              <span>月光</span>
              <strong>+{moonReward}</strong>
            </div>
            <div>
              <ScrollText size={28} />
              <span>诗卷</span>
              <strong>+{scrollReward}</strong>
            </div>
            <div>
              <Gem size={28} />
              <span>宝石</span>
              <strong>+{gemReward}</strong>
            </div>
          </div>

          <PoetryDuelPanel
            ending={ending}
            choice={choice}
            poem={poem}
            badgeUnlocked={poetryDuelUnlocked}
            onComplete={onPoetryDuelComplete}
          />
        </div>

        <aside className="ending-card" aria-label="梦之印记">
          <div className="ending-card__image" style={{ backgroundImage: `url(${bgImage})` }}>
            <span>入梦李白</span>
            <strong>{ending.name}</strong>
          </div>
          <small>长按保存图片</small>
        </aside>
      </main>

      <div className="ending-actions">
        <button className="gold-button" onClick={onSave}>
          <Save size={20} />
          {saved ? '已保存' : '保存结果'}
        </button>
        <button className="glass-button" onClick={onRestart}>
          <RotateCcw size={20} />
          再入一梦
        </button>
        <button className="glass-button" onClick={onHome}>
          <Home size={20} />
          返回主页
        </button>
        <button className="gold-button" onClick={onShare}>
          <Share2 size={20} />
          分享
        </button>
      </div>

      <footer className="dream-trail">
        <span>梦之轨迹</span>
        <div>
          {trail.map((item, index) => (
            <i key={item} className={index === trail.length - 1 ? 'is-current' : ''}>
              {index === 0 ? <Moon size={18} /> : <Sparkles size={18} />}
              <small>{item}</small>
            </i>
          ))}
        </div>
      </footer>
    </section>
  );
}
