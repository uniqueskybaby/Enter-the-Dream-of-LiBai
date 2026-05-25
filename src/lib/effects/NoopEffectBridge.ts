import type { ViewState } from '../../types/game';
import type { PanoramaViewerAdapter } from '../viewer/PannellumAdapter';

export interface EffectBridge {
  mount(container: HTMLElement, viewer: PanoramaViewerAdapter): void;
  play(effectName: string, payload?: Record<string, unknown>): Promise<void>;
  onSceneBeforeExit(sceneId: string): Promise<void>;
  onSceneAfterEnter(sceneId: string): Promise<void>;
  syncView(view: ViewState): void;
  dispose(): void;
}

export class NoopEffectBridge implements EffectBridge {
  mount(_container: HTMLElement, _viewer: PanoramaViewerAdapter): void {}

  async play(_effectName: string, _payload?: Record<string, unknown>): Promise<void> {
    return Promise.resolve();
  }

  async onSceneBeforeExit(_sceneId: string): Promise<void> {
    return Promise.resolve();
  }

  async onSceneAfterEnter(_sceneId: string): Promise<void> {
    return Promise.resolve();
  }

  syncView(_view: ViewState): void {
    return;
  }

  dispose(): void {
    return;
  }
}
