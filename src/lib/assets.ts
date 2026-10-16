export const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (typeof window !== "undefined" &&
  (window.location.pathname.startsWith("/healthysnacks") ||
    window.location.pathname.startsWith("/snack-builder"))
    ? window.location.pathname.startsWith("/healthysnacks")
      ? "/healthysnacks"
      : "/snack-builder"
    : "");

export function assetUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${clean}`;
}
