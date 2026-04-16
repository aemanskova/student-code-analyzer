const WEAK_JWT_MARKERS = [
  "change_me",
  "super_secret_jwt_for_development",
  "secret",
  "password",
  "jwt"
];

export function assertProductionSecurity(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const jwt = process.env.JWT_SECRET?.trim() ?? "";
  if (jwt.length < 32) {
    throw new Error("В production задайте JWT_SECRET длиной не менее 32 символов.");
  }
  const lower = jwt.toLowerCase();
  if (WEAK_JWT_MARKERS.some((m) => lower.includes(m))) {
    throw new Error(
      "JWT_SECRET не должен содержать очевидные шаблоны; используйте криптостойкую случайную строку."
    );
  }
  if (!process.env.CORS_ORIGIN?.trim()) {
    throw new Error(
      "В production обязателен CORS_ORIGIN (точный origin фронтенда, без завершающего /)."
    );
  }
}
