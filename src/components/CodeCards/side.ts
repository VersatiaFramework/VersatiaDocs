import {useSyncExternalStore, type RefObject} from 'react';
import useIsomorphicLayoutEffect from '@docusaurus/useIsomorphicLayoutEffect';

/** The code a Versatia/Bukkit pair shows. */
export type Side = 'versatia' | 'bukkit';

const key = 'versatia.code-side';
const listeners = new Set<() => void>();
let current: Side | undefined;
let clicked: {anchor: HTMLElement; top: number} | undefined;

function read(): Side {
  if (current === undefined) {
    try {
      current = sessionStorage.getItem(key) === 'bukkit' ? 'bukkit' : 'versatia';
    } catch {
      current = 'versatia';
    }
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The side every pair shows: Versatia, unless the reader chose Bukkit during this visit. */
export function useSide(): Side {
  return useSyncExternalStore(subscribe, read, () => 'versatia');
}

/** Flips every pair to `side`; the switch at `anchor` stays where it was on the screen (see {@link useKeptInPlace}). */
export function switchSide(side: Side, anchor: HTMLElement): void {
  clicked = {anchor, top: anchor.getBoundingClientRect().top};
  current = side;
  try {
    sessionStorage.setItem(key, side);
  } catch {
    // storage blocked: the choice lasts until the page is loaded again
  }
  listeners.forEach(listener => listener());
}

/** Once the pairs above the clicked switch have changed height, scrolls it back into place before the browser paints. */
export function useKeptInPlace(anchor: RefObject<HTMLElement | null>, side: Side): void {
  useIsomorphicLayoutEffect(() => {
    if (!clicked || clicked.anchor !== anchor.current) return;
    window.scrollBy(0, clicked.anchor.getBoundingClientRect().top - clicked.top);
    clicked = undefined;
  }, [anchor, side]);
}
