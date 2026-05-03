export const getScopeDisplayName = (scopePath: string): string => {
  const segments = String(scopePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)

  if (segments.length <= 1) {
    return segments[0] || scopePath
  }

  return segments.slice(1).join("/")
}
