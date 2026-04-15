/**
 * Support knowledge base - bundled at build time so it works on Vercel.
 * Run `npm run crawl-support` to refresh, then rebuild.
 */
import data from "@/data/support-knowledge.json";

export type SupportArticle = {
  title: string;
  url: string;
  summary: string;
  keywords?: string;
};

export const supportArticles = data as SupportArticle[];
