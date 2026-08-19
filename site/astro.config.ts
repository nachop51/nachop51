// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { voidPlugin } from "void";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { CODE_THEME } from "../shared/code-theme";
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

/**
 * Wrap every table in the same element TipTap's node view draws in the editor,
 * so shared/markdown.css can hang the scroll and the spacing off one selector
 * in both apps. Without it a wide table has nothing to scroll inside and pushes
 * the whole column out.
 */
function wrapTables() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!Array.isArray(node.children)) return;

      for (const [index, child] of node.children.entries()) {
        walk(child);
        if (child.tagName !== "table") continue;

        node.children[index] = {
          type: "element",
          tagName: "div",
          properties: { className: ["tableWrapper"] },
          children: [child],
        };
      }
    };

    walk(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://nachop51.void.app",
  output: "static",
  integrations: [mdx(), sitemap(), redirects()],
  markdown: {
    // The editor tokenises with this same theme — see shared/code-theme.ts.
    shikiConfig: { theme: CODE_THEME, wrap: false },
    rehypePlugins: [wrapTables],
  },
  adapter: cloudflare({ imageService: "compile" }),
  vite: {
    plugins: [voidPlugin()],
  },
});
