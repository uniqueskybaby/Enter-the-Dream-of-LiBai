import { Feather, Moon, Sparkles } from 'lucide-react';
import type { StoryBlock, StoryChoice } from '../types/game';

interface StoryModalProps {
  story: StoryBlock;
  onChoose: (choice: StoryChoice) => void;
  onClose: () => void;
}

export function StoryModal({ story, onChoose, onClose }: StoryModalProps) {
  return (
    <div className="modal-scrim" role="presentation">
      <section className="story-modal" role="dialog" aria-modal="true" aria-labelledby="story-title">
        <button className="icon-button story-modal__close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <div className="story-modal__ornament"><Moon size={22} /></div>
        <p className="story-modal__speaker" id="story-title">{story.speaker}</p>
        <p className="story-modal__text">{story.text}</p>

        <div className="story-modal__choices">
          {story.choices.map((choice, index) => (
            <button
              key={choice.id}
              className={index === 0 ? 'choice-button choice-button--gold' : 'choice-button'}
              onClick={() => onChoose(choice)}
            >
              {index === 0 ? <Sparkles size={20} /> : <Feather size={20} />}
              <span>{choice.text}</span>
              <small>{choice.tone}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
