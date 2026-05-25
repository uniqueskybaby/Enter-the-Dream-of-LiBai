import { useCallback, useEffect, useMemo, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { AiDreamPanel } from './components/AiDreamPanel';
import { BottomNav } from './components/BottomNav';
import { BranchPanel } from './components/BranchPanel';
import { DialogueStrip } from './components/DialogueStrip';
import { EndingScreen } from './components/EndingScreen';
import { GatePanel } from './components/GatePanel';
import { HomeScreen } from './components/HomeScreen';
import { HudTopBar } from './components/HudTopBar';
import { InfoPanel, type PanelKind } from './components/InfoPanel';
import { LoadingDream } from './components/LoadingDream';
import { PanoramaStage } from './components/PanoramaStage';
import { PuzzleModal } from './components/PuzzleModal';
import { SceneTitle } from './components/SceneTitle';
import { SideJournal } from './components/SideJournal';
import { StoryModal } from './components/StoryModal';
import { NoopEffectBridge } from './lib/effects/NoopEffectBridge';
import { AudioDirector, loadAudioPreferences, musicMoodForGame, soundForHotspot, type AudioPreferences } from './lib/audio/AudioDirector';
import { loadDreamManifest, loadGameConfig, saveGeneratedDreamConfig } from './lib/config';
import { preloadImages } from './lib/preloader';
import { dreamPuzzles, puzzleOrder, buildPuzzleMap, type DreamPuzzle } from './lib/puzzles';
import type { HiddenHotspotDef } from './lib/puzzles';
import {
  ResourceContext,
  loadResources,
  saveResources,
  applyReward,
  REWARDS,
  checkDailyBonus,
  claimDailyBonus,
  type ResourceContextValue,
} from './lib/rewards';
import {
  loadUnlockedAchievements,
  tryUnlock,
  getAchievement,
} from './lib/achievements';
import type { AchievementId, DreamManifestEntry, EndingBlock, PanoramaGameConfig, PlayerResources, RewardPayload, StoryBlock, StoryChoice, ViewState } from './types/game';

type ScreenState = 'home' | 'playing' | 'ending';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const RESULTS_KEY = 'dream-li-bai-results';

function loadSavedResultIds(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(RESULTS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export default function App() {
  const [config, setConfig] = useState<PanoramaGameConfig | null>(null);
  const [dreams, setDreams] = useState<DreamManifestEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenState>('home');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<StoryChoice | null>(null);
  const [pendingEndingId, setPendingEndingId] = useState<string | null>(null);
  const [activePuzzleId, setActivePuzzleId] = useState<DreamPuzzle['id'] | null>(null);
  const [collectedClues, setCollectedClues] = useState<DreamPuzzle['id'][]>([]);
  const [activePanel, setActivePanel] = useState<PanelKind | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [audioPrefs, setAudioPrefs] = useState<AudioPreferences>(loadAudioPreferences);
  const [_view, setView] = useState<ViewState>({ yaw: 0, pitch: 0, fov: 80 });
  const [resources, setResources] = useState<PlayerResources>(loadResources);
  const [unlockedAchievements, setUnlockedAchievements] = useState<AchievementId[]>(loadUnlockedAchievements);
  const [savedResultIds, setSavedResultIds] = useState<string[]>(loadSavedResultIds);
  const [achievementToast, setAchievementToast] = useState<{ name: string; description: string } | null>(null);
  const [foundHiddenIds, setFoundHiddenIds] = useState<string[]>([]);
  const [hiddenRevealToast, setHiddenRevealToast] = useState<{ label: string; dialogue: string } | null>(null);
  const [startTime] = useState(Date.now());

  const effectBridge = useMemo(() => new NoopEffectBridge(), []);
  const audioDirector = useMemo(() => new AudioDirector(), []);
  const soundEnabled = audioPrefs.enabled;

  useEffect(() => () => audioDirector.dispose(), [audioDirector]);

  useEffect(() => {
    if (!config) return;
    const mood = screen === 'home' ? 'home' : screen === 'ending' ? 'ending' : musicMoodForGame(config.gameId);
    audioDirector.playMusic(mood);
  }, [audioDirector, config, screen]);

  const updateAudioPrefs = useCallback((patch: Partial<AudioPreferences>) => {
    setAudioPrefs((prev) => {
      const next = { ...prev, ...patch };
      audioDirector.setPreferences(next);
      return next;
    });
  }, [audioDirector]);

  const toggleSound = useCallback(() => {
    setAudioPrefs((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      audioDirector.setPreferences(next);
      if (next.enabled) audioDirector.play('uiTap');
      return next;
    });
  }, [audioDirector]);

  const grantReward = useCallback((reward: RewardPayload) => {
    setResources((prev) => {
      const next = applyReward(prev, reward);
      saveResources(next);
      return next;
    });
  }, []);

  const spendResource = useCallback((cost: RewardPayload): boolean => {
    let success = false;
    setResources((prev) => {
      const ml = prev.moonlight - (cost.moonlight ?? 0);
      const sc = prev.scroll - (cost.scroll ?? 0);
      const gm = prev.gem - (cost.gem ?? 0);
      if (ml < 0 || sc < 0 || gm < 0) return prev;
      success = true;
      const next = { moonlight: ml, scroll: sc, gem: gm };
      saveResources(next);
      return next;
    });
    return success;
  }, []);

  const resourceCtx: ResourceContextValue = useMemo(() => ({
    resources,
    grant: grantReward,
    spend: spendResource,
  }), [resources, grantReward, spendResource]);

  const unlockAchievement = useCallback((id: AchievementId) => {
    const result = tryUnlock(id, unlockedAchievements);
    if (!result) return;
    setUnlockedAchievements(result.newUnlocked);
    grantReward(result.reward);
    const ach = getAchievement(id);
    if (ach) {
      setAchievementToast({ name: ach.name, description: ach.description });
      audioDirector.play('achievement');
    }
  }, [unlockedAchievements, grantReward, audioDirector]);

  useEffect(() => {
    if (!achievementToast) return;
    const timer = window.setTimeout(() => setAchievementToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [achievementToast]);

  useEffect(() => {
    if (!hiddenRevealToast) return;
    const timer = window.setTimeout(() => setHiddenRevealToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [hiddenRevealToast]);

  useEffect(() => {
    if (screen === 'playing' && checkDailyBonus()) {
      const bonus = claimDailyBonus();
      grantReward(bonus);
      setToast('每日首次入梦奖励：+300 月光, +30 诗卷');
    }
  }, [screen, grantReward]);

  const handleHiddenFound = useCallback((hotspot: HiddenHotspotDef) => {
    if (foundHiddenIds.includes(hotspot.id)) return;
    setFoundHiddenIds((prev) => [...prev, hotspot.id]);
    grantReward(hotspot.reward);
    setHiddenRevealToast({ label: hotspot.label, dialogue: hotspot.dialogue });
    audioDirector.play('hiddenReveal');
    unlockAchievement('hidden_found');
  }, [foundHiddenIds, grantReward, audioDirector, unlockAchievement]);

  useEffect(() => {
    let alive = true;

    loadDreamManifest()
      .then(async (manifest) => {
        if (!alive) return;
        setDreams(manifest);
        const nextConfig = await loadGameConfig(manifest[0]?.gameId);
        if (!alive) return;
        setConfig(nextConfig);
        setCurrentNodeId(nextConfig.startNodeId);
        return preloadImages(nextConfig.nodes.map((node) => node.panoramaUrl));
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : '梦境配置读取失败'));

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const nodesById = useMemo(() => {
    return new Map(config?.nodes.map((node) => [node.id, node]) ?? []);
  }, [config]);

  const currentNode = currentNodeId ? nodesById.get(currentNodeId) : undefined;
  const activeStory: StoryBlock | undefined = activeStoryId && config ? config.stories[activeStoryId] : undefined;
  const ending: EndingBlock | undefined = pendingEndingId && config ? config.endings[pendingEndingId] : undefined;

  const activePuzzleOrder = config?.puzzleOrder ?? puzzleOrder;
  const activePuzzles = useMemo(() => config ? buildPuzzleMap(config) : dreamPuzzles, [config]);
  const activePuzzle = activePuzzleId ? activePuzzles[activePuzzleId] : undefined;

  const clueCount = collectedClues.length;
  const gateReady = activePuzzleOrder.every((id) => collectedClues.includes(id));

  const currentNodeForPlay = useMemo(() => {
    if (!config || !currentNode) return currentNode;
    if (currentNode.id !== config.startNodeId) return currentNode;

    const order = config.puzzleOrder ?? puzzleOrder;
    return {
      ...currentNode,
      hotspots: currentNode.hotspots.map((hotspot, _idx) => {
        const hotspotIndex = order.indexOf(hotspot.id);
        if (hotspotIndex <= 0) {
          return { ...hotspot, state: 'available' as const };
        }
        const prerequisite = order[hotspotIndex - 1];
        if (!collectedClues.includes(prerequisite)) {
          return { ...hotspot, state: 'locked' as const };
        }
        return { ...hotspot, state: 'available' as const };
      }),
    };
  }, [collectedClues, config, currentNode]);

  const resetRun = useCallback(() => {
    if (!config) return;
    setCurrentNodeId(config.startNodeId);
    setSelectedChoice(null);
    setPendingEndingId(null);
    setActiveStoryId(null);
    setActivePuzzleId(null);
    setActivePanel(null);
    setAiPanelOpen(false);
    setCollectedClues([]);
    setFoundHiddenIds([]);
    setSaved(false);
    setScreen('playing');
  }, [config]);

  const loadNewConfig = useCallback(async (newConfig: PanoramaGameConfig) => {
    const savedConfig = await saveGeneratedDreamConfig(newConfig);
    setConfig(savedConfig);
    loadDreamManifest()
      .then(setDreams)
      .catch(() => undefined);
    setCurrentNodeId(savedConfig.startNodeId);
    setSelectedChoice(null);
    setPendingEndingId(null);
    setActiveStoryId(null);
    setActivePuzzleId(null);
    setActivePanel(null);
    setAiPanelOpen(false);
    setCollectedClues([]);
    setFoundHiddenIds([]);
    setSaved(false);
    setToast(`已永久保存「${savedConfig.poem.source || savedConfig.world.worldName}」为玩家AI生成诗境。`);
    setScreen('playing');
  }, []);

  const returnHome = useCallback(() => {
    if (!config) return;
    audioDirector.play('uiTap');
    setCurrentNodeId(config.startNodeId);
    setSelectedChoice(null);
    setPendingEndingId(null);
    setActiveStoryId(null);
    setActivePuzzleId(null);
    setActivePanel(null);
    setAiPanelOpen(false);
    setCollectedClues([]);
    setFoundHiddenIds([]);
    setSaved(false);
    setScreen('home');
  }, [audioDirector, config]);

  const selectDream = useCallback(async (gameId: string) => {
    if (config?.gameId === gameId) {
      setActivePanel(null);
      return;
    }

    try {
      setLoadError(null);
      audioDirector.play('transition');
      const nextConfig = await loadGameConfig(gameId);
      setConfig(nextConfig);
      setCurrentNodeId(nextConfig.startNodeId);
      setSelectedChoice(null);
      setPendingEndingId(null);
      setActiveStoryId(null);
      setActivePuzzleId(null);
      setActivePanel(null);
      setAiPanelOpen(false);
      setCollectedClues([]);
      setFoundHiddenIds([]);
      setSaved(false);
      setScreen('home');
      await preloadImages(nextConfig.nodes.map((node) => node.panoramaUrl));
      setToast(`已切换至「${nextConfig.poem.source}」。`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '梦境切换失败。');
    }
  }, [audioDirector, config?.gameId]);

  const startGame = useCallback(() => {
    void audioDirector.resume();
    audioDirector.play('startDream');
    resetRun();
  }, [audioDirector, resetRun]);

  const handleHotspotClick = useCallback((hotspotId: string) => {
    if (!config || !currentNodeForPlay || isTransitioning) return;

    const hotspot = currentNodeForPlay.hotspots.find((item) => item.id === hotspotId);
    if (!hotspot) return;

    if (hotspot.state === 'locked') {
      audioDirector.play('hotspotLocked');
      const lockedStory = config.stories[hotspot.storyId];
      setToast(lockedStory?.text ?? '这处诗意尚未解锁。');
      return;
    }

    audioDirector.play(soundForHotspot(hotspot.id, hotspot.label));

    const puzzleMap = config.puzzles ?? dreamPuzzles;
    if (currentNodeForPlay.id === config.startNodeId && hotspot.id in puzzleMap) {
      setActivePuzzleId(hotspot.id as DreamPuzzle['id']);
      return;
    }

    setActiveStoryId(hotspot.storyId);
  }, [audioDirector, config, currentNodeForPlay, isTransitioning]);

  const handleChoice = useCallback(async (choice: StoryChoice) => {
    if (!config || !currentNode) return;

    audioDirector.play('transition');
    setSelectedChoice(choice);
    setPendingEndingId(choice.endingId);
    setActiveStoryId(null);
    setIsTransitioning(true);
    await effectBridge.onSceneBeforeExit(currentNode.id);
    await wait(420);
    setCurrentNodeId(choice.nextNodeId);
    await preloadImages([nodesById.get(choice.nextNodeId)?.panoramaUrl ?? '']);
    await wait(760);
    await effectBridge.onSceneAfterEnter(choice.nextNodeId);
    setIsTransitioning(false);
  }, [audioDirector, config, currentNode, effectBridge, nodesById]);

  const finishBranch = useCallback(() => {
    audioDirector.play('endingReveal');
    const isRare = Boolean(ending?.rarity && ['珍稀', '稀有', '传说'].some((word) => ending.rarity.includes(word)));
    grantReward(isRare ? REWARDS.endingRare : REWARDS.endingReached);
    unlockAchievement('first_dream');
    if (collectedClues.length === activePuzzleOrder.length) unlockAchievement('all_clues');
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed < 180) unlockAchievement('speed_run');
    setScreen('ending');
  }, [audioDirector, ending, grantReward, unlockAchievement, collectedClues, startTime, activePuzzleOrder]);

  const solvePuzzle = useCallback((puzzle: DreamPuzzle) => {
    audioDirector.play('clueCollect');
    setCollectedClues((current) => {
      if (current.includes(puzzle.id)) return current;
      const next = [...current, puzzle.id];
      const total = activePuzzleOrder.length;
      setToast(next.length === total ? '诗意碎片集齐，星河诗阵已开启。' : puzzle.rewardLine);
      return next;
    });
    setActivePuzzleId(null);
    grantReward(REWARDS.puzzleSolved);
    if (activePuzzleOrder.indexOf(puzzle.id) === 0) unlockAchievement('first_puzzle');
  }, [audioDirector, grantReward, unlockAchievement, activePuzzleOrder]);

  const openPanel = useCallback((kind: PanelKind) => {
    audioDirector.play('panelOpen');
    setActivePanel(kind);
    setAiPanelOpen(false);
  }, [audioDirector]);

  const openAiPanel = useCallback(() => {
    audioDirector.play('panelOpen');
    setAiPanelOpen(true);
    setActivePanel(null);
  }, [audioDirector]);

  const closePanel = useCallback(() => {
    audioDirector.play('panelClose');
    setActivePanel(null);
  }, [audioDirector]);

  const closeAiPanel = useCallback(() => {
    audioDirector.play('panelClose');
    setAiPanelOpen(false);
  }, [audioDirector]);

  const closeStory = useCallback(() => {
    audioDirector.play('panelClose');
    setActiveStoryId(null);
  }, [audioDirector]);

  const closePuzzle = useCallback(() => {
    audioDirector.play('panelClose');
    setActivePuzzleId(null);
  }, [audioDirector]);

  const closeModals = useCallback(() => {
    audioDirector.play('panelClose');
    setActivePanel(null);
    setAiPanelOpen(false);
    setActiveStoryId(null);
    setActivePuzzleId(null);
  }, [audioDirector]);

  const openGate = useCallback(() => {
    if (!gateReady) {
      audioDirector.play('hotspotLocked');
      const total = activePuzzleOrder.length;
      setToast(`还差 ${total - clueCount} 枚诗意碎片。按顺序寻找场景中的发光热点。`);
      return;
    }
    audioDirector.play('gateOpen');
    setActiveStoryId('story_gate');
  }, [audioDirector, clueCount, gateReady, activePuzzleOrder]);

  const saveResult = useCallback(() => {
    if (!ending || !config) return;
    audioDirector.play('uiTap');
    const next = Array.from(new Set([...savedResultIds, ending.id]));
    window.localStorage.setItem(RESULTS_KEY, JSON.stringify(next));
    setSavedResultIds(next);
    setSaved(true);
    setToast('结果已存入本地梦册。');
    if (Object.keys(config.endings).every((id) => next.includes(id))) unlockAchievement('all_endings');
  }, [audioDirector, config, ending, savedResultIds, unlockAchievement]);

  const shareResult = useCallback(async () => {
    if (!ending || !config) return;
    audioDirector.play('uiTap');
    const text = `我在《入梦李白》中成为了「${ending.name}」：${ending.text}`;
    if (navigator.share) {
      await navigator.share({ title: config.title, text }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(text).catch(() => undefined);
      setToast('结局文案已复制。');
    }
  }, [audioDirector, config, ending]);

  if (loadError) {
    return <LoadingDream message={loadError} />;
  }

  if (!config || !currentNode) {
    return <LoadingDream />;
  }

  if (screen === 'home') {
    return (
      <>
        <HomeScreen
          config={config}
          dreams={dreams}
          resources={resources}
          savedResultCount={savedResultIds.length}
          achievementCount={unlockedAchievements.length}
          onStart={startGame}
          onOpenPanel={openPanel}
          onOpenAi={openAiPanel}
          onSelectDream={selectDream}
        />
        {activePanel && (
          <InfoPanel
            kind={activePanel}
            config={config}
            dreams={dreams}
            activeGameId={config.gameId}
            clues={collectedClues}
            soundEnabled={soundEnabled}
            musicVolume={audioPrefs.musicVolume}
            sfxVolume={audioPrefs.sfxVolume}
            onToggleSound={toggleSound}
            onMusicVolumeChange={(musicVolume) => updateAudioPrefs({ musicVolume })}
            onSfxVolumeChange={(sfxVolume) => updateAudioPrefs({ sfxVolume })}
            onClose={closePanel}
            onOpenAi={openAiPanel}
            onSelectDream={selectDream}
            resources={resources}
            unlockedAchievements={unlockedAchievements}
            foundHiddenIds={foundHiddenIds}
            onSpend={spendResource}
          />
        )}
        {aiPanelOpen && <AiDreamPanel config={config} onClose={closeAiPanel} onToast={setToast} onAchievement={() => unlockAchievement('ai_draft')} onLoadConfig={loadNewConfig} />}
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  if (screen === 'ending' && ending && selectedChoice) {
    const endingNode = nodesById.get(selectedChoice.nextNodeId) ?? currentNode;
    return (
      <>
        <EndingScreen
          ending={ending}
          node={endingNode}
          choice={selectedChoice}
          poem={config.poem}
          onRestart={startGame}
          onHome={returnHome}
          onSave={saveResult}
          onShare={shareResult}
          onPoetryDuelComplete={() => unlockAchievement('poetry_duel')}
          saved={saved}
          poetryDuelUnlocked={unlockedAchievements.includes('poetry_duel')}
        />
        {toast && <div className="toast">{toast}</div>}
        {achievementToast && (
          <div className="achievement-toast">
            <span className="achievement-toast__icon">★</span>
            <div className="achievement-toast__text">
              <strong>{achievementToast.name}</strong>
              <small>{achievementToast.description}</small>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!currentNodeForPlay) {
    return <LoadingDream />;
  }

  return (
    <ResourceContext.Provider value={resourceCtx}>
    <main className="play-screen">
      <PanoramaStage
        node={currentNodeForPlay}
        locked={isTransitioning || Boolean(activeStory) || Boolean(activePuzzle)}
        onHotspotClick={handleHotspotClick}
        onViewChange={(nextView) => {
          setView(nextView);
          effectBridge.syncView(nextView);
        }}
        onTogglePanel={(panel) => openPanel(panel as PanelKind)}
        onToggleSound={toggleSound}
        onCloseModal={closeModals}
        onHiddenFound={handleHiddenFound}
        foundHiddenIds={foundHiddenIds}
        hiddenHotspots={config.hiddenHotspots}
        isMainScene={currentNode.id === config.startNodeId}
      />

      <div className="stage-vignette" />
      <HudTopBar poem={config.poem} onOpenPanel={openPanel} resources={resources} />
      <SceneTitle node={currentNodeForPlay} />
      <SideJournal node={currentNodeForPlay} clueCount={clueCount} />

      <button className="sound-button" aria-label="声音" onClick={() => {
        toggleSound();
        setToast(soundEnabled ? '声音已关闭。' : '声音已开启。');
      }}>
        {soundEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
        <span>{soundEnabled ? '声音' : '静音'}</span>
      </button>

      <DialogueStrip node={currentNodeForPlay} />
      <BottomNav onOpenPanel={openPanel} onOpenGate={openGate} />

      {currentNode.id === config.startNodeId && (
        <GatePanel ready={gateReady} clueCount={clueCount} onOpen={openGate} />
      )}

      {selectedChoice && ending && currentNode.id !== config.startNodeId && (
        <BranchPanel node={currentNode} choice={selectedChoice} ending={ending} onFinish={finishBranch} />
      )}

      {activeStory && (
        <StoryModal story={activeStory} onChoose={handleChoice} onClose={closeStory} />
      )}

      {activePuzzle && (
        <PuzzleModal
          puzzle={activePuzzle}
          solved={collectedClues.includes(activePuzzle.id)}
          onSound={(effect) => audioDirector.play(effect)}
          onSolved={solvePuzzle}
          onClose={closePuzzle}
        />
      )}

      {activePanel && (
        <InfoPanel
          kind={activePanel}
          config={config}
          dreams={dreams}
          activeGameId={config.gameId}
          clues={collectedClues}
          soundEnabled={soundEnabled}
          musicVolume={audioPrefs.musicVolume}
          sfxVolume={audioPrefs.sfxVolume}
          onToggleSound={toggleSound}
          onMusicVolumeChange={(musicVolume) => updateAudioPrefs({ musicVolume })}
          onSfxVolumeChange={(sfxVolume) => updateAudioPrefs({ sfxVolume })}
          onClose={closePanel}
          onOpenAi={openAiPanel}
          onSelectDream={selectDream}
          resources={resources}
          unlockedAchievements={unlockedAchievements}
          foundHiddenIds={foundHiddenIds}
          onSpend={spendResource}
        />
      )}

      {aiPanelOpen && <AiDreamPanel config={config} onClose={closeAiPanel} onToast={setToast} onAchievement={() => unlockAchievement('ai_draft')} onLoadConfig={loadNewConfig} />}

      <div className={`scene-transition ${isTransitioning ? 'is-active' : ''}`}>
        <span>星河换景</span>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {achievementToast && (
        <div className="achievement-toast">
          <span className="achievement-toast__icon">★</span>
          <div className="achievement-toast__text">
            <strong>{achievementToast.name}</strong>
            <small>{achievementToast.description}</small>
          </div>
        </div>
      )}

      {hiddenRevealToast && (
        <div className="hidden-hotspot-reveal">
          <strong>{hiddenRevealToast.label}</strong>
          <p>{hiddenRevealToast.dialogue}</p>
        </div>
      )}
    </main>
    </ResourceContext.Provider>
  );
}
