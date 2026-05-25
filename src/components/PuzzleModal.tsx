import { Check, Feather, HelpCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SoundEffect } from '../lib/audio/AudioDirector';
import type { DreamPuzzle } from '../lib/puzzles';

type PuzzleSoundEffect = Extract<SoundEffect, 'puzzlePick' | 'puzzleCorrect' | 'puzzleWrong'>;

interface PuzzleModalProps {
  puzzle: DreamPuzzle;
  solved: boolean;
  onSound?: (effect: PuzzleSoundEffect) => void;
  onSolved: (puzzle: DreamPuzzle) => void;
  onClose: () => void;
}

export function PuzzleModal({ puzzle, solved, onSound, onSolved, onClose }: PuzzleModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(solved ? puzzle.rewardLine : null);
  const isSequence = puzzle.kind === 'sequence';

  const correct = useMemo(() => {
    if (selected.length !== puzzle.answer.length) return false;
    return selected.every((item, index) => item === puzzle.answer[index]);
  }, [puzzle.answer, selected]);

  const choose = (option: string) => {
    if (solved) return;

    if (!isSequence) {
      const isCorrect = option === puzzle.answer[0];
      onSound?.('puzzlePick');
      setSelected([option]);
      setMessage(isCorrect ? puzzle.rewardLine : puzzle.hint);
      onSound?.(isCorrect ? 'puzzleCorrect' : 'puzzleWrong');
      if (isCorrect) window.setTimeout(() => onSolved(puzzle), 500);
      return;
    }

    if (selected.includes(option)) return;
    onSound?.('puzzlePick');
    const next = [...selected, option];
    setSelected(next);
    setMessage(null);

    if (next.length === puzzle.answer.length) {
      const isCorrect = next.every((item, index) => item === puzzle.answer[index]);
      setMessage(isCorrect ? puzzle.rewardLine : puzzle.hint);
      onSound?.(isCorrect ? 'puzzleCorrect' : 'puzzleWrong');
      if (isCorrect) window.setTimeout(() => onSolved(puzzle), 600);
    }
  };

  return (
    <div className="modal-scrim" role="presentation">
      <section className="puzzle-modal" role="dialog" aria-modal="true" aria-labelledby="puzzle-title">
        <button className="icon-button story-modal__close" onClick={onClose} aria-label="关闭">
          ×
        </button>

        <div className="puzzle-modal__head">
          <span>{puzzle.motif}</span>
          <div>
            <small>{puzzle.speaker}</small>
            <h2 id="puzzle-title">{puzzle.title}</h2>
          </div>
        </div>

        <p className="puzzle-modal__prompt">{puzzle.prompt}</p>

        {isSequence && (
          <div className="sequence-board" aria-label="已选择顺序">
            {puzzle.answer.map((_, index) => (
              <i key={index}>{selected[index] ?? '？'}</i>
            ))}
          </div>
        )}

        <div className={isSequence ? 'puzzle-options puzzle-options--sequence' : 'puzzle-options'}>
          {puzzle.options.map((option) => {
            const isPicked = selected.includes(option);
            return (
              <button key={option} className={isPicked ? 'is-picked' : ''} onClick={() => choose(option)}>
                {isPicked ? <Check size={18} /> : <Feather size={18} />}
                {option}
              </button>
            );
          })}
        </div>

        <div className="puzzle-modal__footer">
          <button className="glass-button puzzle-help" onClick={() => setMessage(puzzle.hint)}>
            <HelpCircle size={18} />
            提示
          </button>
          {isSequence && (
            <button className="glass-button puzzle-help" onClick={() => {
              setSelected([]);
              setMessage(null);
            }}>
              <RotateCcw size={18} />
              重排
            </button>
          )}
          {solved && (
            <button className="gold-button puzzle-help" onClick={onClose}>
              <Sparkles size={18} />
              已收集
            </button>
          )}
        </div>

        {message && <p className={correct || solved ? 'puzzle-message is-correct' : 'puzzle-message'}>{message}</p>}
      </section>
    </div>
  );
}
