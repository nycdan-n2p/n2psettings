#!/usr/bin/env npx ts-node
/**
 * Crawl net2phone support site and update data/support-knowledge.json
 *
 * Run: npx ts-node scripts/crawl-support.ts
 * Or: npm run crawl-support (add script to package.json)
 *
 * Fetches search results for common keywords, discovers article URLs,
 * and optionally fetches article content. Updates the static JSON.
 */

import * as fs from "fs";
import * as path from "path";

const SUPPORT_BASE = "https://support.net2phone.com";
const SEARCH_URL = `${SUPPORT_BASE}/s/?searchString=`;
const ARTICLE_URL = `${SUPPORT_BASE}/s/article/`;

interface SupportArticle {
  title: string;
  url: string;
  summary: string;
  keywords?: string;
}

const SEED_ARTICLES: SupportArticle[] = [
  {
    title: "Web Calling: User Guide",
    url: `${ARTICLE_URL}Web-Calling-User-Guide`,
    summary: "Complete guide to using net2phone Web Calling. Covers setup, making and receiving calls from your browser.",
    keywords: "web calling, browser calling, softphone",
  },
  {
    title: "How To Setup Your Call Forwarding",
    url: `${ARTICLE_URL}How-To-Setup-Your-Call-Forwarding`,
    summary: "Step-by-step instructions for setting up call forwarding.",
    keywords: "call forwarding, forward calls",
  },
  {
    title: "Data vs. Minute Calling",
    url: `${ARTICLE_URL}Data-vs-Minute-Calling`,
    summary: "Explains the difference between data-based and minute-based calling plans.",
    keywords: "data calling, minute calling, plans",
  },
];

async function fetchSearchResults(query: string): Promise<{ title: string; urlName: string }[]> {
  const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "net2phone-support-crawler/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const articles: { title: string; urlName: string }[] = [];
    const linkRe = /href="\/s\/article\/([^"]+)"[^>]*>([^<]+)</g;
    let m;
    const seen = new Set<string>();
    while ((m = linkRe.exec(html)) !== null) {
      const urlName = m[1];
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      if (title && !seen.has(urlName)) {
        seen.add(urlName);
        articles.push({ title, urlName });
      }
    }
    return articles;
  } catch (e) {
    console.warn(`Search "${query}" failed:`, e instanceof Error ? e.message : e);
    return [];
  }
}

async function main() {
  const queries = ["calling", "voicemail", "ring group", "call queue", "extension", "porting", "forwarding"];
  const discovered = new Map<string, SupportArticle>();

  for (const seed of SEED_ARTICLES) {
    discovered.set(seed.url, seed);
  }

  console.log("Crawling support site...");
  for (const q of queries) {
    const results = await fetchSearchResults(q);
    for (const r of results) {
      const url = `${ARTICLE_URL}${r.urlName}`;
      if (!discovered.has(url)) {
        discovered.set(url, {
          title: r.title,
          url,
          summary: r.title,
          keywords: q,
        });
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const outPath = path.join(process.cwd(), "data", "support-knowledge.json");
  const articles = Array.from(discovered.values());
  fs.writeFileSync(outPath, JSON.stringify(articles, null, 2), "utf-8");
  console.log(`Wrote ${articles.length} articles to ${outPath}`);
}

main().catch(console.error);
