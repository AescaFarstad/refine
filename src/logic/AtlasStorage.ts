// Pure storage/utilities for sprite atlases; derived atlases are generated externally.

import { itemsAtlasFrames, itemsAtlasMeta } from '../data/itemsAtlas';
import { locationsAtlasFrames, locationsAtlasMeta } from '../data/locationsAtlas';

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AtlasSource = HTMLImageElement;

export interface AtlasMeta { w: number; h: number; padding?: number }

export interface AtlasData {
  source: AtlasSource;
  frames: Map<string, AtlasFrame>;
  meta?: AtlasMeta;
}

export type AtlasKey = 'items' | 'locations' | 'molecules';

/**
 * Simple storage for sprite atlases.
 * Currently loads the items atlas from `/images/items.(png|json)`.
 */
export class AtlasStorage {
  private itemsAtlas: AtlasData | null = null;
  private itemsAtlasLoaded = false;
  private itemsAtlasLoading: Promise<void> | null = null;
  private locationsAtlas: AtlasData | null = null;
  private locationsAtlasLoaded = false;
  private locationsAtlasLoading: Promise<void> | null = null;
  private runtimeAtlases: Map<string, AtlasData>;
  private signatureWaferAnchors: Map<string, { x: number; y: number }>;

  constructor() {
    this.runtimeAtlases = new Map();
    this.signatureWaferAnchors = new Map();
  }

  /** Load the items atlas if not already loaded. */
  public async loadItemsAtlas(): Promise<void> {
    if (this.itemsAtlasLoaded) return;
    if (this.itemsAtlasLoading) return this.itemsAtlasLoading;

    this.itemsAtlasLoading = (async () => {
      // Use bundled JSON data
      const frames = new Map<string, AtlasFrame>();
      for (const [key, frame] of Object.entries(itemsAtlasFrames)) {
        frames.set(key, frame);
      }

      // Prefer WebP with alpha; fall back to PNG if unavailable.
      const webpUrl = `/images/items.webp`;
      const pngUrl = `/images/items.png`;

      let source: AtlasSource | null = null;
      try {
        source = await this.loadImage(webpUrl);
      } catch (_err) {
        source = await this.loadImage(pngUrl);
      }

      this.itemsAtlas = { source: source!, frames, meta: itemsAtlasMeta || undefined };
      this.itemsAtlasLoaded = true;
    })()
      .catch((err) => {
        console.error('Failed to load items atlas:', err);
        // Reset state to allow retry
        this.itemsAtlasLoading = null;
        this.itemsAtlasLoaded = false;
        throw err;
      });

    return this.itemsAtlasLoading;
  }

  public isItemsAtlasLoaded(): boolean {
    return this.itemsAtlasLoaded;
  }

  public getItemsSource(): AtlasSource | null {
    return this.itemsAtlas?.source || null;
  }

  public getItemsImage(): HTMLImageElement | null { return this.itemsAtlas?.source || null; }
  public getItemsMeta(): AtlasMeta | null { return this.itemsAtlas?.meta || null; }

  public getItemsFrame(name: string): AtlasFrame | null {
    return this.itemsAtlas?.frames.get(name) || null;
  }

  /** Load the locations atlas if not already loaded. */
  public async loadLocationsAtlas(): Promise<void> {
    if (this.locationsAtlasLoaded) return;
    if (this.locationsAtlasLoading) return this.locationsAtlasLoading;

    this.locationsAtlasLoading = (async () => {
      // Use bundled JSON data
      const frames = new Map<string, AtlasFrame>();
      for (const [key, frame] of Object.entries(locationsAtlasFrames)) {
        frames.set(key, frame);
      }

      // Prefer WebP with alpha; fall back to PNG if unavailable.
      const webpUrl = `/images/locations.webp`;
      const pngUrl = `/images/locations.png`;

      let source: AtlasSource | null = null;
      try {
        source = await this.loadImage(webpUrl);
      } catch (_err) {
        source = await this.loadImage(pngUrl);
      }

      this.locationsAtlas = { source: source!, frames, meta: locationsAtlasMeta || undefined };
      this.locationsAtlasLoaded = true;
    })()
      .catch((err) => {
        console.error('Failed to load locations atlas:', err);
        this.locationsAtlasLoading = null;
        this.locationsAtlasLoaded = false;
        throw err;
      });

    return this.locationsAtlasLoading;
  }

  public isLocationsAtlasLoaded(): boolean {
    return this.locationsAtlasLoaded;
  }

  public getLocationsSource(): AtlasSource | null {
    return this.locationsAtlas?.source || null;
  }

  public getLocationsFrame(name: string): AtlasFrame | null {
    return this.locationsAtlas?.frames.get(name) || null;
  }

  public setSignatureWaferAnchor(id: string, anchor: { x: number; y: number }): void {
    this.signatureWaferAnchors.set(id, anchor);
  }

  public getSignatureWaferAnchor(id: string): { x: number; y: number } | null {
    return this.signatureWaferAnchors.get(id) || null;
  }

  public setRuntimeAtlas(key: AtlasKey, data: AtlasData): void {
    this.runtimeAtlases.set(key, data);
  }

  public getRuntimeAtlas(key: AtlasKey): AtlasData | null {
    return this.runtimeAtlases.get(key) || null;
  }

  public getMoleculesSource(): AtlasSource | null {
    return this.runtimeAtlases.get('molecules')?.source || null;
  }

  public getMoleculesMeta(): AtlasMeta | null {
    return this.runtimeAtlases.get('molecules')?.meta || null;
  }

  public getMoleculesFrame(name: string): AtlasFrame | null {
    return this.runtimeAtlases.get('molecules')?.frames.get(name) || null;
  }

  // Generic accessors for dev tooling
  public getFrames(key: AtlasKey): Map<string, AtlasFrame> | null {
    switch (key) {
      case 'items':
        return this.itemsAtlas?.frames || null;
      case 'locations':
        return this.locationsAtlas?.frames || null;
      case 'molecules':
        return this.runtimeAtlases.get(key)?.frames || null;
    }
  }

  public getSource(key: AtlasKey): HTMLImageElement | null {
    switch (key) {
      case 'items':
        return this.itemsAtlas?.source || null;
      case 'locations':
        return this.locationsAtlas?.source || null;
      case 'molecules':
        return this.runtimeAtlases.get(key)?.source || null;
    }
  }

  public getMeta(key: AtlasKey): AtlasMeta | null {
    switch (key) {
      case 'items':
        return this.itemsAtlas?.meta || null;
      case 'locations':
        return this.locationsAtlas?.meta || null;
      case 'molecules':
        return this.runtimeAtlases.get(key)?.meta || null;
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

}

export const atlasStorage = new AtlasStorage();
export default atlasStorage;

// Helper to enumerate available atlases for tooling/dev UIs
export function listAtlasKeys(): AtlasKey[] {
  return ['items', 'locations', 'molecules'];
}
