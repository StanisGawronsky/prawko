/** Prefiks Vite (`/` lokalnie, `/nazwa-repo/` na GitHub Pages). */
function assetBase(): string {
  const b = import.meta.env.BASE_URL;
  return b.endsWith('/') ? b : `${b}/`;
}

/** Ścieżki w JSON zaczynają się od `./exam-all-modules-export.media/...` — URL względem `base`. */
export function toPublicUrl(relative: string | null | undefined): string | null {
  if (!relative) return null;
  const trimmed = relative.replace(/^\.\//, '').replace(/^\//, '');
  return `${assetBase()}${trimmed}`;
}

function mediaKindFromUrl(url: string): 'image' | 'video' | 'unknown' {
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return 'video';
  if (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)) return 'image';
  return 'unknown';
}

/**
 * `VITE_USE_REMOTE_MEDIA=true` — najpierw CDN z JSON (deploy bez kopii mediów w `public/`).
 * Domyślnie / false — najpierw ścieżki lokalne → `public/` → statyczne w `dist/` (np. po `npm run media:link`).
 */
function useRemoteMediaFirst(): boolean {
  return import.meta.env.VITE_USE_REMOTE_MEDIA === 'true';
}

export function pickMediaUrl(row: {
  media: {
    primaryUrl: string | null;
    imageUrl: string | null;
    local: { primary: string | null };
  };
  summary: { mediaRelativePath: string | null };
}): { href: string; isRemote: boolean; kind: 'image' | 'video' | 'unknown' } | null {
  if (useRemoteMediaFirst()) {
    const remoteFirst = row.media.primaryUrl || row.media.imageUrl;
    if (remoteFirst) {
      return {
        href: remoteFirst,
        isRemote: true,
        kind: mediaKindFromUrl(remoteFirst),
      };
    }
  }

  const local = row.media.local?.primary || row.summary.mediaRelativePath;
  if (local) {
    const u = toPublicUrl(local);
    if (u) {
      return { href: u, isRemote: false, kind: mediaKindFromUrl(u) };
    }
  }
  const remote = row.media.primaryUrl || row.media.imageUrl;
  if (remote) {
    return { href: remote, isRemote: true, kind: mediaKindFromUrl(remote) };
  }
  return null;
}
