export type ReviewCardData = {
  name: string
  initial?: string
  stars: number
  text: string
  date?: string
  /** Link back to this review on Google, when the feed supplies one. */
  url?: string | null
}

export declare const AV: string[]
export declare function esc(v: unknown): string
export declare function safeUrl(u: unknown): string
export declare function reviewCard(r: ReviewCardData, i: number): string
export declare function marqueeHtml(list: ReviewCardData[]): string
