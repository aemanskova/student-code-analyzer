import type { AnalysisFormValues } from "./types"

const ESLINT_CONFIG_EXTENSIONS = new Set(["js", "mjs", "cjs"])

export const ESLINT_CONFIG_AVAILABLE_LIBRARIES = [
  "eslint",
  "@eslint/js",
  "typescript",
  "typescript-eslint",
  "globals",
  "eslint-config-prettier"
]

export const ESLINT_CONFIG_IGNORED_PATHS = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".next",
  "out",
  ".analysis-eslint"
]

export const ESLINT_CONFIG_INFO_TEXT = [
  "ESLint config используется только для JS и TypeScript-метрик линтера.",
  "Поддерживаются flat config-файлы eslint.config.js, eslint.config.mjs и eslint.config.cjs.",
  `В backend уже доступны библиотеки: ${ESLINT_CONFIG_AVAILABLE_LIBRARIES.join(", ")}.`,
  "Можно использовать конфиги для обычного JavaScript, browser/node globals, TypeScript recommended, TypeScript strict, Prettier-compatible config и их комбинации.",
  "Новые npm-пакеты из конфига автоматически не устанавливаются. Если конфиг импортирует отсутствующую библиотеку или плагин, ESLint-метрики будут пропущены, остальные метрики анализа продолжат считаться.",
  `При запуске ESLint дополнительно исключаются: ${ESLINT_CONFIG_IGNORED_PATHS.join(", ")}.`
].join("\n")

export const supportsEslintConfig = (direction: AnalysisFormValues["direction"]): boolean =>
  direction === "js" || direction === "typescript"

export const getEslintConfigFormat = (
  fileName: string
): AnalysisFormValues["eslintConfigFormat"] => {
  const extension = fileName.split(".").pop()?.toLowerCase()
  return ESLINT_CONFIG_EXTENSIONS.has(extension || "")
    ? (extension as AnalysisFormValues["eslintConfigFormat"])
    : undefined
}
