// Pure storage/utilities for sprite atlases; derived atlases are generated externally.

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

export type AtlasKey = 'items';

/**
 * Simple storage for sprite atlases.
 * Currently loads the items atlas from `/images/items.(png|json)`.
 */
export class AtlasStorage {
  private itemsAtlas: AtlasData | null = null;
  private itemsAtlasLoaded = false;
  private itemsAtlasLoading: Promise<void> | null = null;
  private moleculeAtlas: Map<string, string>;

  constructor() {
    this.moleculeAtlas = new Map();
  }

  /** Load the items atlas if not already loaded. */
  public async loadItemsAtlas(): Promise<void> {
    if (this.itemsAtlasLoaded) return;
    if (this.itemsAtlasLoading) return this.itemsAtlasLoading;

    const jsonUrl = '/images/items.json';

    this.itemsAtlasLoading = (async () => {
      const framesObj = await this.fetchAtlasJson(jsonUrl);

      // Prefer WebP with alpha; fall back to PNG if unavailable.
      // Add a cache-busting version derived from atlas content to keep
      // image and JSON in lockstep.
      const hash = (() => {
        let h = 2166136261 >>> 0; // FNV-like
        const keys = Object.keys(framesObj).filter(k => k !== '__meta').sort();
        for (const k of keys) {
          const f = (framesObj as any)[k] as AtlasFrame;
          const mix = (f.x | 0) ^ (f.y << 8) ^ (f.w << 16) ^ (f.h << 24);
          for (let i = 0; i < k.length; i++) h = (h ^ k.charCodeAt(i)) * 16777619 >>> 0;
          h = (h ^ mix) * 16777619 >>> 0;
        }
        return (h >>> 0).toString(16);
      })();
      const metaW = (this.itemsAtlas?.meta?.w) || (framesObj.__meta?.w) || 0;
      const metaH = (this.itemsAtlas?.meta?.h) || (framesObj.__meta?.h) || 0;
      const ver = `${metaW}x${metaH}-${hash}`;
      const webpUrl = `/images/items.webp?v=${ver}`;
      const pngUrl = `/images/items.png?v=${ver}`;

      let source: AtlasSource | null = null;
      try {
        source = await this.loadImage(webpUrl);
      } catch (_err) {
        source = await this.loadImage(pngUrl);
      }

      const frames = new Map<string, AtlasFrame>();
      let meta: AtlasMeta | undefined = undefined;
      for (const key of Object.keys(framesObj)) {
        const entry = (framesObj as any)[key];
        if (key === '__meta' && entry && typeof entry.w === 'number' && typeof entry.h === 'number') {
          meta = { w: entry.w, h: entry.h, padding: typeof entry.padding === 'number' ? entry.padding : undefined };
          continue;
        }
        const f = entry as AtlasFrame;
        if (f && typeof f.x === 'number' && typeof f.y === 'number' && typeof f.w === 'number' && typeof f.h === 'number') {
          frames.set(key, { x: f.x, y: f.y, w: f.w, h: f.h });
        }
      }

      this.itemsAtlas = { source: source!, frames, meta };

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

  public clearMoleculeAtlas(): void {
    this.moleculeAtlas.clear();
  }

  public setMoleculeImage(id: string, dataUrl: string): void {
    this.moleculeAtlas.set(id, dataUrl);
  }

  public getMoleculeImage(id: string): string | null {
    if (!this.moleculeAtlas) return null;
    return this.moleculeAtlas.get(id) || null;
  }

  // Generic accessors for dev tooling
  public getFrames(key: AtlasKey): Map<string, AtlasFrame> | null {
    switch (key) {
      case 'items':
        return this.itemsAtlas?.frames || null;
    }
  }

  public getSource(key: AtlasKey): HTMLImageElement | null {
    switch (key) {
      case 'items':
        return this.itemsAtlas?.source || null;
    }
  }

  public getMeta(key: AtlasKey): AtlasMeta | null {
    switch (key) {
      case 'items':
        return this.itemsAtlas?.meta || null;
    }
  }

  private async fetchAtlasJson(url: string): Promise<Record<string, any>> {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} loading atlas json ${url}`);
    }
    const data = (await res.json()) as Record<string, any>;
    return data || {};
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
  return ['items'];
}
