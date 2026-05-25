import { Copy, Loader, RefreshCcw, Sparkles, Wand2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateDreamDraft, recommendPoemLine } from '../lib/ai/storyPipeline';
import { isLlmApiReady, isImageApiReady, generatePanoramaImage, generateFullGameConfig } from '../lib/ai/apiClient';
import { contextualFallbackPanoramaUrl } from '../lib/config';
import type { PanoramaGameConfig } from '../types/game';

type GenerationPhase = 'idle' | 'llm' | 'image' | 'done' | 'error';

interface AiDreamPanelProps {
  config: PanoramaGameConfig;
  onClose: () => void;
  onToast: (message: string) => void;
  onAchievement?: () => void;
  onLoadConfig?: (config: PanoramaGameConfig) => void | Promise<void>;
}

export function AiDreamPanel({ config, onClose, onToast, onAchievement, onLoadConfig }: AiDreamPanelProps) {
  const [poemLine, setPoemLine] = useState(config.poem.line);
  const [draftSeed, setDraftSeed] = useState(0);
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [phaseMessage, setPhaseMessage] = useState('');
  const [aiImageUrl] = useState<string | null>(null);
  const draft = useMemo(() => generateDreamDraft(poemLine), [poemLine, draftSeed]);

  const llmReady = isLlmApiReady();
  const imageReady = isImageApiReady();

  const generateLocalDraft = () => {
    setDraftSeed((seed) => seed + 1);
    onToast('本地草稿已刷新。');
    onAchievement?.();
  };

  const recommend = () => {
    setPoemLine(recommendPoemLine(Date.now()));
    window.setTimeout(() => setDraftSeed((s) => s + 1), 0);
  };

  const copyPrompt = async () => {
    await navigator.clipboard?.writeText(draft.panoramaPrompt).catch(() => undefined);
    onToast('全景 Prompt 已复制。');
  };

  const generateFullDream = async () => {
    setPhase('llm');
    setPhaseMessage('正在构思梦境世界...');

    let gameConfig: PanoramaGameConfig;
    try {
      gameConfig = await generateFullGameConfig(poemLine);
      setPhaseMessage(`世界「${gameConfig.world.worldName}」构思完成，准备绘制画面...`);
    } catch (err) {
      setPhase('error');
      setPhaseMessage(`LLM 生成失败：${err instanceof Error ? err.message : '未知错误'}`);
      return;
    }

    if (imageReady) {
      setPhase('image');
      const imagePrompts = gameConfig.imagePrompts || {};
      const visualTone = gameConfig.world.visualTone || 'Chinese ink painting style, dreamlike';
      const negPrompt = 'text, watermark, low quality, blurry, ugly, deformed';

      const sceneImageTasks = [
        { id: 'main_scene', label: '主梦境', panorama: true },
        { id: 'branch_a', label: '分支梦境A', panorama: true },
        { id: 'branch_b', label: '分支梦境B', panorama: true },
        { id: 'branch_c', label: '分支梦境C', panorama: true },
        { id: 'ending_a', label: '结局A', panorama: false },
        { id: 'ending_b', label: '结局B', panorama: false },
        { id: 'ending_c', label: '结局C', panorama: false },
      ];

      let completed = 0;
      for (const task of sceneImageTasks) {
        completed++;
        setPhaseMessage(`正在绘制 ${task.label}（${completed}/${sceneImageTasks.length}）...`);

        const basePrompt = imagePrompts[task.id] || `${visualTone}, ${task.label}`;
        const fullPrompt = task.panorama
          ? [
              '360 degree equirectangular panorama, 2:1 aspect ratio',
              'seamless left-right edge, continuous horizon across both edges',
              'important subjects away from the left and right border seam',
              basePrompt,
              'full spherical environment, ethereal atmosphere, high quality, detailed, no UI, no text, no watermark',
            ].join(', ')
          : `${basePrompt}, cinematic composition, ethereal atmosphere, high quality`;

        let result: { url: string } | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt > 0) {
              setPhaseMessage(`正在绘制 ${task.label}（${completed}/${sceneImageTasks.length}）重试${attempt}...`);
              await new Promise((r) => setTimeout(r, 5000 * attempt));
            }
            result = await generatePanoramaImage(fullPrompt, negPrompt);
            break;
          } catch (err) {
            if (attempt === 2) console.warn(`生图失败 (${task.label}):`, err);
          }
        }

        if (result) {
          if (task.panorama) {
            gameConfig = {
              ...gameConfig,
              nodes: gameConfig.nodes.map((node) =>
                node.id === task.id ? { ...node, panoramaUrl: result!.url } : node
              ),
            };
          } else {
            const endingId = task.id;
            const ending = gameConfig.endings[endingId];
            if (ending) {
              gameConfig = {
                ...gameConfig,
                endings: { ...gameConfig.endings, [endingId]: { ...ending, imageUrl: result.url } },
              };
            }
          }
        }

        if (completed < sceneImageTasks.length) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    const fallbackPanorama = contextualFallbackPanoramaUrl(gameConfig);
    gameConfig = {
      ...gameConfig,
      nodes: gameConfig.nodes.map((node) => ({
        ...node,
        panoramaUrl: node.panoramaUrl?.startsWith('__PLACEHOLDER') ? fallbackPanorama : (node.panoramaUrl || fallbackPanorama),
      })),
    };

    setPhase('done');
    setPhaseMessage('全部资源生成完毕，正在写入本地项目...');
    onAchievement?.();

    window.setTimeout(() => {
      void (async () => {
        try {
          await onLoadConfig?.(gameConfig);
          onClose();
        } catch (err) {
          setPhase('error');
          setPhaseMessage(`保存失败：${err instanceof Error ? err.message : '未知错误'}`);
        }
      })();
    }, 1000);
  };

  const isWorking = phase === 'llm' || phase === 'image';

  return (
    <div className="modal-scrim" role="presentation">
      <section className="ai-panel" role="dialog" aria-modal="true" aria-labelledby="ai-title">
        <button className="icon-button story-modal__close" onClick={onClose} aria-label="关闭" disabled={isWorking}>×</button>
        <header className="info-panel__head">
          <Wand2 size={28} />
          <div>
            <small>AI 诗境生成</small>
            <h2 id="ai-title">创作一场新梦</h2>
          </div>
        </header>

        <div className="ai-panel__input">
          <label htmlFor="poem-input">输入一句诗</label>
          <textarea
            id="poem-input"
            value={poemLine}
            onChange={(event) => setPoemLine(event.target.value)}
            rows={3}
            disabled={isWorking}
          />
          <div>
            <button className="glass-button" onClick={recommend} disabled={isWorking}>
              <RefreshCcw size={18} />
              推荐诗句
            </button>
            <button className="glass-button" onClick={generateLocalDraft} disabled={isWorking}>
              <Sparkles size={18} />
              本地草稿
            </button>
            {llmReady && (
              <button className="gold-button" onClick={generateFullDream} disabled={isWorking}>
                {isWorking ? <Loader size={18} className="spin" /> : <Zap size={18} />}
                {isWorking ? phaseMessage : '一键生成新梦境'}
              </button>
            )}
          </div>
        </div>

        {phase === 'error' && (
          <div className="ai-error">
            <p>{phaseMessage}</p>
            <button className="glass-button" onClick={() => setPhase('idle')}>重试</button>
          </div>
        )}

        {phase === 'done' && (
          <div className="ai-success">
            <Sparkles size={24} />
            <p>{phaseMessage}</p>
          </div>
        )}

        {phase === 'idle' && (
          <div className="ai-result">
            <article>
              <small>母世界（本地预览）</small>
              <strong>{draft.worldName}</strong>
              <p>核心意象：{draft.motifs.join(' / ')}</p>
            </article>
            <article>
              <small>热点与谜题</small>
              <ul>
                {draft.hotspots.map((hotspot) => (
                  <li key={hotspot.id}>{hotspot.label}：{hotspot.puzzleHook}</li>
                ))}
              </ul>
            </article>
            <article>
              <small>分支梦境</small>
              <p>{draft.branchNames.join('、')}</p>
            </article>
            <article className="ai-prompt">
              <small>全景生成 Prompt</small>
              <pre>{draft.panoramaPrompt}</pre>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="glass-button" onClick={copyPrompt}>
                  <Copy size={18} />
                  复制 Prompt
                </button>
              </div>
            </article>
            {aiImageUrl && (
              <article>
                <small>AI 生成全景</small>
                <img src={aiImageUrl} alt="AI 生成的全景图" style={{ width: '100%', borderRadius: '8px', marginTop: '8px' }} />
              </article>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
