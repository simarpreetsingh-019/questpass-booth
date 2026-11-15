/**
 * Stands in for QuestPass's sponsor registry (@/config/sponsors) inside the
 * engine. A booth has one brand at a time: the runtime sets it before every
 * render (see src/core/brand.ts), and the engine reads it through
 * pageSponsor().
 */
export interface SponsorTheme {
  accent: string;
  accentDark: string;
  accentSoft: string;
  highlight: string;
  highlight2: string;
  base: string;
  surface: string;
  surface2: string;
  text: string;
}

export interface SponsorBrand {
  id: string;
  name: string;
  url: string;
  wordmark: { src: string; width: number; height: number; alt: string };
  logo: { width: number; height: number; mark: string[]; word: string[]; markColor: string; wordColor: string };
  logoImage?: string;
  theme: SponsorTheme;
  copy: { presentedBy: string; poweredBy: string; posterNote: string };
  ownedSlots: number[];
  themeOwnedBoards?: boolean;
  seekingSponsors?: boolean;
  ticketPrefix: string;
}

export const DEFAULT_THEME: SponsorTheme = {
  accent: "#38FF9C",
  accentDark: "#2A9660",
  accentSoft: "#C9F7DF",
  highlight: "#FFC440",
  highlight2: "#FF8A28",
  base: "#0E0E0E",
  surface: "#1A1A1A",
  surface2: "#141414",
  text: "#F5F5F0",
};

let active: SponsorBrand = {
  id: "questpass-booth",
  name: "QuestPass Booth",
  url: "",
  wordmark: { src: "", width: 120, height: 40, alt: "QuestPass Booth" },
  logo: { width: 120, height: 40, mark: [], word: [], markColor: DEFAULT_THEME.accent, wordColor: DEFAULT_THEME.text },
  theme: DEFAULT_THEME,
  copy: { presentedBy: "Presented by", poweredBy: "by", posterNote: "" },
  ownedSlots: [],
  ticketPrefix: "QP",
};

/** The brand the next render uses. */
export function setActiveSponsor(b: SponsorBrand) {
  active = b;
}
export const activeSponsor = (): SponsorBrand => active;
export const pageSponsor = (): SponsorBrand => active;
