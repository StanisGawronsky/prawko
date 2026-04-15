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

export function pickMediaUrl(row: {
  media: {
    primaryUrl: string | null;
    local: { primary: string | null };
  };
  summary: { mediaRelativePath: string | null };
}): { href: string; isRemote: boolean; kind: 'image' | 'video' | 'unknown' } | null {
  const local =
    row.media.local?.primary || row.summary.mediaRelativePath;
  if (local) {
    const u = toPublicUrl(local);
    if (u) {
      const kind = /\.(mp4|webm|ogg)(\?|$)/i.test(u)
        ? 'video'
        : /\.(jpe?g|png|gif|webp)(\?|$)/i.test(u)
          ? 'image'
          : 'unknown';
      return { href: u, isRemote: false, kind };
    }
  }
  const remote = row.media.primaryUrl;
  if (remote) {
    const kind = /\.(mp4|webm|ogg)(\?|$)/i.test(remote)
      ? 'video'
      : /\.(jpe?g|png|gif|webp)(\?|$)/i.test(remote)
        ? 'image'
        : 'unknown';
    return { href: remote, isRemote: true, kind };
  }
  return null;
}
