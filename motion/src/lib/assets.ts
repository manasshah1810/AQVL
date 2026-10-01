import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
const cache = new Map<string, HTMLImageElement>();
export const useImage = (path: string) => {
  const src = staticFile(path);
  const [img, setImg] = useState<HTMLImageElement | null>(cache.get(src) ?? null);
  const [handle] = useState(() => (cache.get(src) ? null : delayRender('image ' + path)));
  useEffect(() => {
    if (img) return;
    const i = new Image();
    i.onload = () => {
      cache.set(src, i);
      setImg(i);
      if (handle !== null) continueRender(handle);
    };
    i.src = src;
  }, [img, src, handle]);
  return img;
};
