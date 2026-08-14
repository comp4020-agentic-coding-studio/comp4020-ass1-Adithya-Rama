// import.meta.env.BASE_URL reflects astro.config.mjs's `base` verbatim, with
// no guaranteed trailing slash -- joining a path onto it directly can glue
// the segment to the repo name (e.g. "/repoimg/x.webp"). Always go through
// this helper when building an asset or route path from BASE_URL.
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\//, "")}`;
}
