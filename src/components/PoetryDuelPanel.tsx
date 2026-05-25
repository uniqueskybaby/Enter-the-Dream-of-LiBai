import { useMemo, useState } from 'react';
import { CheckCircle2, Feather, Loader2, Medal, Send, Sparkles, Wine } from 'lucide-react';
import { buildFallbackPoemCritique, critiquePlayerPoem, type PoemCritiqueContext } from '../lib/ai/apiClient';
import type { EndingBlock, PoemMeta, StoryChoice } from '../types/game';

export interface PoetryDuelResult {
  playerLine: string;
  review: string;
}

interface PoetryDuelPanelProps {
  ending: EndingBlock;
  choice: StoryChoice;
  poem: PoemMeta;
  badgeUnlocked: boolean;
  onComplete: (result: PoetryDuelResult) => void;
}

type DuelStage = 'invite' | 'declined' | 'compose' | 'review';

const BADGE_URL = '/assets/ui/poetry-duel-medal.png';

export function PoetryDuelPanel({
  ending,
  choice,
  poem,
  badgeUnlocked,
  onComplete,
}: PoetryDuelPanelProps) {
  const [stage, setStage] = useState<DuelStage>('invite');
  const [line, setLine] = useState('');
  const [submittedLine, setSubmittedLine] = useState('');
  const [review, setReview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [completed, setCompleted] = useState(false);

  const promptLine = useMemo(() => buildPromptLine(ending, choice), [ending, choice]);
  const placeholder = useMemo(() => buildPlaceholder(ending, choice), [ending, choice]);
  const hasBadge = badgeUnlocked || completed;

  const submitPoem = async () => {
    if (isReviewing) return;

    const playerLine = line.replace(/\s+/g, ' ').trim();
    if (!playerLine) {
      setError('李白举杯等你一句。');
      return;
    }

    setError(null);
    setIsReviewing(true);

    const context: PoemCritiqueContext = {
      poemLine: poem.line,
      poemSource: poem.source,
      endingName: ending.name,
      endingText: ending.text,
      choiceText: choice.text,
      choiceTone: choice.tone,
      playerLine,
    };

    let nextReview = '';
    try {
      nextReview = await critiquePlayerPoem(context);
    } catch {
      nextReview = buildFallbackPoemCritique(context);
    }

    setSubmittedLine(playerLine);
    setReview(nextReview);
    setCompleted(true);
    setStage('review');
    setIsReviewing(false);
    onComplete({ playerLine, review: nextReview });
  };

  return (
    <section className={`poetry-duel poetry-duel--${stage}`} aria-label="与李白斗酒赋诗">
      <header className="poetry-duel__head">
        <span className="poetry-duel__icon"><Wine size={24} /></span>
        <div>
          <small>酒阑问诗</small>
          <h2>可否愿与我斗酒赋诗？</h2>
        </div>
      </header>

      {stage === 'invite' && (
        <>
          <p className="poetry-duel__copy">
            李白将杯中月色递来：梦已走到「{ending.name}」，若你愿意，便以此结局为意，留下一句自己的诗。
          </p>
          <div className="poetry-duel__actions">
            <button className="gold-button" type="button" onClick={() => setStage('compose')}>
              <Wine size={20} />
              愿与先生一饮
            </button>
            <button className="glass-button" type="button" onClick={() => setStage('declined')}>
              且收此梦
            </button>
          </div>
        </>
      )}

      {stage === 'declined' && (
        <>
          <p className="poetry-duel__copy">
            李白笑着把酒盏留在月下：诗兴不急，归梦之前若想再饮，仍可唤我。
          </p>
          <div className="poetry-duel__actions">
            <button className="glass-button" type="button" onClick={() => setStage('compose')}>
              <Sparkles size={20} />
              再举杯
            </button>
          </div>
        </>
      )}

      {stage === 'compose' && (
        <form className="poetry-duel__form" onSubmit={(event) => {
          event.preventDefault();
          void submitPoem();
        }}>
          <p className="poetry-duel__copy">{promptLine}</p>
          <label htmlFor="poetry-duel-line">梦中一句</label>
          <textarea
            id="poetry-duel-line"
            value={line}
            rows={3}
            maxLength={220}
            onChange={(event) => {
              setLine(event.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
          />
          <div className="poetry-duel__submit-row">
            {error && <small className="poetry-duel__error">{error}</small>}
            <button className="gold-button" type="submit" disabled={isReviewing}>
              {isReviewing ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
              {isReviewing ? '李白斟酒读诗中' : '请李白论诗'}
            </button>
          </div>
        </form>
      )}

      {stage === 'review' && (
        <div className="poetry-duel__result">
          <div className="poetry-duel__review">
            <span><Feather size={18} /> 你写下</span>
            <blockquote>{submittedLine}</blockquote>
            <p>{review}</p>
          </div>
          <div className={`poetry-duel__badge ${hasBadge ? 'is-unlocked' : ''}`}>
            <img src={BADGE_URL} alt="梦中与李白对诗勋章" />
            <div>
              <span>{hasBadge ? <CheckCircle2 size={16} /> : <Medal size={16} />} {hasBadge ? '勋章已入梦册' : '新勋章'}</span>
              <strong>梦中与李白对诗</strong>
              <small>李白不问高下，只记此刻诗心。</small>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function buildPromptLine(ending: EndingBlock, choice: StoryChoice): string {
  const tone = choice.tone || '诗心';
  return `你刚选择「${choice.text}」，走入「${ending.name}」。可借「${ending.rewardText}」起兴，也可只写这一刻的${tone}。`;
}

function buildPlaceholder(ending: EndingBlock, choice: StoryChoice): string {
  const cleanReward = ending.rewardText.replace(/[《》]/g, '').split(/[·、，,]/)[0] || ending.name;
  return `${cleanReward}入杯，梦随${choice.tone || '诗心'}生。也可写几行醉笔，让李白与你细论。`;
}
