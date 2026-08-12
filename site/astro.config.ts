// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { voidPlugin } from "void";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { AstroIntegration } from "astro";

const CONTENT = "./src/content/blog";

function redirects(): AstroIntegration {
  return {
    name: "redirects",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const lines: string[] = [];

        for (const lang of await readdir(CONTENT)) {
          const langDir = path.join(CONTENT, lang);
          for (const file of await readdir(langDir)) {
            if (!file.endsWith(".md")) continue;

            const raw = await readFile(path.join(langDir, file), "utf8");
            const { data } = matter(raw);
            const slug = file.replace(/\.md$/, "");
            const prefix = lang === "en" ? "/blog" : `/${lang}/blog`;

            for (const old of data.oldSlugs ?? []) {
              lines.push(`${prefix}/${old} ${prefix}/${slug} 301`);
            }
          }
        }

        if (lines.length > 0) {
          await writeFile(new URL("_redirects", dir), lines.join("\n") + "\n");
        }
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://nachop51.void.app",
  output: "static",
  integrations: [mdx(), sitemap(), redirects()],
  adapter: cloudflare({ imageService: "compile" }),
  vite: {
    plugins: [voidPlugin()],
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Atkinson",
      cssVariable: "--font-atkinson",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/atkinson-regular.woff"],
            weight: 400,
            style: "normal",
            display: "swap",
          },
          {
            src: ["./src/assets/fonts/atkinson-bold.woff"],
            weight: 700,
            style: "normal",
            display: "swap",
          },
        ],
      },
    },
  ],
});
