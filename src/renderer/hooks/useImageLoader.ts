import { useEffect, useRef } from 'react';
import { usePresets } from '../context/GridContext';
import type { Preset } from '../../shared/types';

const loadingPaths = new Set<string>();

/**
 * Preload images for a list of presets, caching results in PresetContext.
 * Uses Promise.all for parallel IPC calls and deduplicates in-flight requests.
 */
export function usePreloadImages() {
  const { getCachedImage, cacheImage } = usePresets();

  return async (presetList: Preset[]) => {
    const toLoad = presetList.filter(
      (p) => p.image && !getCachedImage(p.image) && !loadingPaths.has(p.image),
    );
    if (toLoad.length === 0) return;

    const paths = toLoad.map((p) => p.image!);
    paths.forEach((p) => loadingPaths.add(p));

    await Promise.all(
      paths.map(async (imagePath) => {
        try {
          const dataUrl = await window.tgrid.invoke('load-image', imagePath);
          if (dataUrl) cacheImage(imagePath, dataUrl);
        } finally {
          loadingPaths.delete(imagePath);
        }
      }),
    );
  };
}

/**
 * Lazily load a single image into the cache if not already present.
 * Deduplicates concurrent requests for the same path.
 */
export function useLazyImage(imagePath: string | null) {
  const { imageCache, cacheImage } = usePresets();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!imagePath || imagePath === prevPathRef.current || imageCache[imagePath] || loadingPaths.has(imagePath)) {
      prevPathRef.current = imagePath;
      return;
    }
    prevPathRef.current = imagePath;
    loadingPaths.add(imagePath);

    window.tgrid.invoke('load-image', imagePath).then((dataUrl) => {
      if (dataUrl) cacheImage(imagePath, dataUrl);
    }).finally(() => {
      loadingPaths.delete(imagePath);
    });
  }, [imagePath, cacheImage]); // intentionally omit imageCache to avoid re-runs on every cache update

  return imagePath ? imageCache[imagePath] || null : null;
}
