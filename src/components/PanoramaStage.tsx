import { useEffect, useRef, useState } from 'react';
import type { HotspotConfig, PanoramaNode, ViewState } from '../types/game';
import { clampPitch, findHotspotNearView } from '../lib/geometry';
import { PannellumAdapter } from '../lib/viewer/PannellumAdapter';
import { hiddenHotspots as defaultHiddenHotspots, type HiddenHotspotDef } from '../lib/puzzles';

interface PanoramaStageProps {
  node: PanoramaNode;
  locked: boolean;
  onHotspotClick: (hotspotId: string) => void;
  onViewChange: (view: ViewState) => void;
  onViewerReady?: (adapter: PannellumAdapter) => void;
  onTogglePanel?: (panel: string) => void;
  onToggleSound?: () => void;
  onCloseModal?: () => void;
  onHiddenFound?: (hotspot: HiddenHotspotDef) => void;
  foundHiddenIds?: string[];
  hiddenHotspots?: HiddenHotspotDef[];
  isMainScene?: boolean;
}

export function PanoramaStage({
  node,
  locked,
  onHotspotClick,
  onViewChange,
  onViewerReady,
  onTogglePanel,
  onToggleSound,
  onCloseModal,
  onHiddenFound,
  foundHiddenIds = [],
  hiddenHotspots = defaultHiddenHotspots,
  isMainScene = false,
}: PanoramaStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<PannellumAdapter | null>(null);
  const nodeRef = useRef(node);
  const lockedRef = useRef(locked);
  const hotspotIdsRef = useRef<string[]>([]);
  const sceneLoadedRef = useRef(false);
  const hotspotCycleRef = useRef(0);
  const dwellTimerRef = useRef<number | null>(null);
  const dwellTargetRef = useRef<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [revealedHidden, setRevealedHidden] = useState<string[]>([]);

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const adapter = new PannellumAdapter();
    adapterRef.current = adapter;
    adapter.onHotspotClick(onHotspotClick);
    adapter.onViewChange(onViewChange);
    adapter.mount(container, { scene: node }).then(() => {
      hotspotIdsRef.current = node.hotspots.map((hotspot) => hotspot.id);
      sceneLoadedRef.current = true;
      onViewerReady?.(adapter);
    });

    return () => adapter.destroy();
  }, []);

  useEffect(() => {
    adapterRef.current?.onHotspotClick(onHotspotClick);
  }, [onHotspotClick]);

  useEffect(() => {
    adapterRef.current?.onViewChange(onViewChange);
  }, [onViewChange]);

  useEffect(() => {
    if (!sceneLoadedRef.current) return;
    adapterRef.current?.loadScene(node, { mode: 'no-direct-flash' }).then(() => {
      hotspotIdsRef.current = node.hotspots.map((hotspot) => hotspot.id);
    });
  }, [node.id]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || !sceneLoadedRef.current) return;
    adapter.removeHotspots(hotspotIdsRef.current);
    adapter.addHotspots(node.hotspots);
    hotspotIdsRef.current = node.hotspots.map((hotspot) => hotspot.id);
  }, [node.hotspots]);

  // Hidden hotspot dwell detection
  useEffect(() => {
    if (!isMainScene) return;
    const interval = window.setInterval(() => {
      const adapter = adapterRef.current;
      if (!adapter || lockedRef.current) return;
      const view = adapter.getView();

      for (const hidden of hiddenHotspots) {
        if (foundHiddenIds.includes(hidden.id) || revealedHidden.includes(hidden.id)) continue;
        const dYaw = Math.abs(view.yaw - hidden.yaw);
        const normalizedDYaw = dYaw > 180 ? 360 - dYaw : dYaw;
        const dPitch = Math.abs(view.pitch - hidden.pitch);
        const dist = Math.sqrt(normalizedDYaw * normalizedDYaw + dPitch * dPitch);

        if (dist < hidden.triggerRadius) {
          if (dwellTargetRef.current !== hidden.id) {
            dwellTargetRef.current = hidden.id;
            dwellTimerRef.current = Date.now();
          } else if (dwellTimerRef.current && Date.now() - dwellTimerRef.current >= hidden.dwellMs) {
            setRevealedHidden((prev) => [...prev, hidden.id]);
            onHiddenFound?.(hidden);
            dwellTargetRef.current = null;
            dwellTimerRef.current = null;
          }
        } else if (dwellTargetRef.current === hidden.id) {
          dwellTargetRef.current = null;
          dwellTimerRef.current = null;
        }
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [isMainScene, foundHiddenIds, revealedHidden, onHiddenFound, hiddenHotspots]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const adapter = adapterRef.current;
      if (!adapter || lockedRef.current) return;

      const key = event.key.toLowerCase();
      const view = adapter.getView();
      const step = event.shiftKey ? 12 : 7;

      const preventKeys = ['arrowleft', 'a', 'arrowright', 'd', 'arrowup', 'w', 'arrowdown', 's', ' ', 'e', 'tab', 'q', 'r', 'h', 'f', 'm'];
      if (preventKeys.includes(key) || /^[1-3]$/.test(key)) {
        event.preventDefault();
      }

      if (key === 'arrowleft' || key === 'a') {
        adapter.setView({ yaw: view.yaw - step }, true);
      }
      if (key === 'arrowright' || key === 'd') {
        adapter.setView({ yaw: view.yaw + step }, true);
      }
      if (key === 'arrowup' || key === 'w') {
        adapter.setView({ pitch: clampPitch(view.pitch + step * 0.6) }, true);
      }
      if (key === 'arrowdown' || key === 's') {
        adapter.setView({ pitch: clampPitch(view.pitch - step * 0.6) }, true);
      }
      if (key === ' ' || key === 'e') {
        const hotspot = findHotspotNearView(view, nodeRef.current.hotspots);
        if (hotspot) {
          onHotspotClick(hotspot.id);
        }
      }
      if (key === 'tab') {
        const available = nodeRef.current.hotspots.filter((h) => h.state === 'available');
        if (available.length > 0) {
          hotspotCycleRef.current = (hotspotCycleRef.current + 1) % available.length;
          const target = available[hotspotCycleRef.current];
          adapter.setView({ yaw: target.yaw, pitch: target.pitch }, true);
        }
      }
      if (key === 'r') {
        const initial = nodeRef.current.initialView;
        adapter.setView({ yaw: initial.yaw, pitch: initial.pitch }, true);
      }
      if (key === 'h') {
        setShowHelp((prev) => !prev);
      }
      if (/^[1-3]$/.test(key)) {
        const index = parseInt(key) - 1;
        const hotspots = nodeRef.current.hotspots;
        if (index < hotspots.length) {
          adapter.setView({ yaw: hotspots[index].yaw, pitch: hotspots[index].pitch }, true);
        }
      }
      if (key === 'q') {
        onTogglePanel?.('bag');
      }
      if (key === 'm') {
        onToggleSound?.();
      }
      if (key === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }
      if (key === 'escape') {
        onCloseModal?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onHotspotClick, onTogglePanel, onToggleSound, onCloseModal]);

  return (
    <div className="panorama-stage" aria-label={node.title}>
      <div ref={containerRef} className="panorama-stage__viewer" />
      <Crosshair hotspots={node.hotspots} />
      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function Crosshair({ hotspots }: { hotspots: HotspotConfig[] }) {
  const hasAvailable = hotspots.some((hotspot) => hotspot.state === 'available');
  return (
    <div className={`crosshair ${hasAvailable ? 'is-awake' : ''}`} aria-hidden="true">
      <span />
    </div>
  );
}

const keyBindings = [
  ['W/A/S/D', '移动视角'],
  ['Shift+方向', '快速移动'],
  ['Space/E', '交互热点'],
  ['Tab', '切换热点'],
  ['1/2/3', '跳转热点'],
  ['R', '重置视角'],
  ['Q', '打开行囊'],
  ['M', '切换静音'],
  ['F', '全屏'],
  ['H', '显示/隐藏帮助'],
  ['Esc', '关闭面板'],
];

function KeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="keyboard-help" onClick={onClose}>
      <div className="keyboard-help__card">
        <h3>快捷键</h3>
        <dl>
          {keyBindings.map(([key, desc]) => (
            <div key={key}>
              <dt><kbd>{key}</kbd></dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
        <small>按 H 关闭</small>
      </div>
    </div>
  );
}
