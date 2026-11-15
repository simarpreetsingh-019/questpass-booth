/** The booth fields frame-words.ts reads (QuestPass's @/types Booth). */
export interface Booth {
    slug: string;
    words?: Record<string, {
        mode?: "fixed" | "edit" | "off";
        text?: string;
    }>;
}
