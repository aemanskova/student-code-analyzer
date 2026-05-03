export const glossarySections = ["html", "css", "git", "javascript", "typescript", "vue"] as const;

export type GlossarySection = (typeof glossarySections)[number];

export type GlossarySectionInfo = {
  key: GlossarySection;
  label: string;
  available: boolean;
};

export type GlossaryMetric = {
  order: number;
  metric: string;
  translation: string;
  description: string;
};
