import type React from 'react';
import type { SceneState, SceneElement } from '@aqvl/runtime';
import type { RenderableConnection, RenderableElement } from './types';

/**
 * Per-frame data for decoration providers, keyed by provider `key`. Hosts pass
 * it to GenericSceneRenderer as `sceneMetadata`; a scene may also carry its own
 * `metadata` bag (from AQIR ANNOTATE primitives), which the host's entries
 * override key by key.
 */
export type SceneMetadata = Readonly<Record<string, unknown>>;

/** A node after a provider's treatment, plus the lift `LiftGroup` eases it toward. */
export interface TreatedNode {
  node: RenderableElement;
  liftY: number;
}

export interface DecorationContext<D> {
  sceneState: SceneState;
  /** Every scene element, in scene order. */
  elements: SceneElement[];
  /** This provider's data for the frame (whatever `select` returned). */
  data: D;
  /** The connections this provider claimed via `claimsConnection`, routed but not drawn by the generic edge pass. */
  connections: RenderableConnection[];
}

/**
 * Something drawn over / under a generic scene without GenericSceneRenderer
 * knowing what it is. A provider is active for a frame when `select` returns a
 * value other than null / undefined; inactive providers contribute nothing.
 *
 * Draw order: every active provider's `renderUnderlay` (registration order),
 * then the generic edges, then every `renderOverlay`, then the nodes.
 */
export interface DecorationProvider<D = unknown> {
  /** Metadata key this provider reads; also its identity in the registry (re-registering a key replaces it). */
  key: string;
  /** This frame's data. Default: `metadata[key]`. Override to read scene annotations directly. */
  select?: (sceneState: SceneState, metadata: SceneMetadata) => D | null | undefined;
  /** Restyles a node. The first active provider with a treatment is the only one applied; its nodes are wrapped in a LiftGroup. */
  treatNode?: (node: RenderableElement, el: SceneElement, data: D) => TreatedNode;
  /** Takes a connection away from the generic edge pass, to be drawn by this provider instead. */
  claimsConnection?: (connection: RenderableConnection, data: D) => boolean;
  renderUnderlay?: (ctx: DecorationContext<D>) => React.ReactNode;
  renderOverlay?: (ctx: DecorationContext<D>) => React.ReactNode;
}

const providers: DecorationProvider<any>[] = [];

/** Adds (or replaces, by `key`) a provider. Returns a function that removes it. */
export function registerDecorationProvider<D>(provider: DecorationProvider<D>): () => void {
  const existing = providers.findIndex((p) => p.key === provider.key);
  if (existing >= 0) providers[existing] = provider;
  else providers.push(provider);
  return () => {
    const at = providers.indexOf(provider);
    if (at >= 0) providers.splice(at, 1);
  };
}

export function getDecorationProviders(): readonly DecorationProvider<unknown>[] {
  return providers;
}

export interface ActiveDecoration {
  provider: DecorationProvider<unknown>;
  data: unknown;
}

/** The providers active for this scene, each with its data, in registration order. */
export function resolveDecorations(sceneState: SceneState, hostMetadata?: SceneMetadata | null): ActiveDecoration[] {
  const metadata: SceneMetadata = {
    ...((sceneState as { metadata?: SceneMetadata }).metadata ?? {}),
    ...(hostMetadata ?? {}),
  };
  const active: ActiveDecoration[] = [];
  for (const provider of providers) {
    const data = provider.select ? provider.select(sceneState, metadata) : metadata[provider.key];
    if (data !== null && data !== undefined) active.push({ provider, data });
  }
  return active;
}
