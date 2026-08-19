---
# Not a published post. Copy this into site/src/content/blog/<lang>/ to preview
# markdown.css end to end, then delete it again — the CMS export wipes that
# directory on every deploy.
title: Every element, once
description: A kitchen-sink post used to compare the editor against production.
pubDate: "2026-08-18T10:00:00Z"
tags: ["css", "typography"]
---

The export pipeline writes plain markdown to disk, Astro renders it, and the
CMS shows you the same thing while you type. This post exists to prove that
last claim — it uses every construct the pipeline can produce.

## Headings carry the outline

Second-level headings open a section, and the scale steps down gently from
there rather than shouting at each level.

### A third level, for detail

Body copy sits at a measure of roughly sixty-five characters, which is where
reading speed peaks for continuous prose. Inline bits: **bold**, *italic*,
~~struck~~, `inlineCode()`, a [link to the repo](https://github.com/nachop51),
and an <abbr title="Content Management System">CMS</abbr> abbreviation.

#### Fourth level

##### Fifth level

###### Sixth level

Anything below h4 stays close to body size and leans on weight instead.

## Lists

- Deployments are queued, not immediate
- Each post carries a published snapshot
  - Nested items stay tight against the parent
  - A second nested item
- Old slugs become 301 redirects at build time

1. Write in the editor
2. Publish the post
3. Export to `site/src/content/blog/<lang>/`
4. Build and deploy

- [ ] Table support in TipTap
- [x] Image upload on paste

## Quotes

> The editor and the site share one stylesheet. If they drift, the WYSIWYG is
> a lie and the whole point of the CMS is gone.

## Code

Inline `go run ./cmd/cms` starts the server. Blocks get the full treatment:

```go
func writePost(contentDir string, p *ent.Post) error {
	s := p.PublishedSnapshot
	body := []byte("---\n" + string(head) + "---\n\n" + s.Content)
	return os.WriteFile(filepath.Join(dir, s.Slug+".md"), body, 0o644)
}
```

```ts
const editor = useEditor({
  extensions: [StarterKit, Image, Markdown],
  editorProps: { attributes: { class: 'markdown' } },
})
```

## Tables

| Stage    | Owner     | Output                    |
| -------- | --------- | ------------------------- |
| Edit     | TipTap    | Markdown string           |
| Export   | Go        | `.md` with frontmatter    |
| Render   | Astro     | Static HTML               |
| Deploy   | Scheduler | Uploaded bundle           |

## The rest

Press <kbd>Cmd</kbd> + <kbd>S</kbd> to force a save.

---

A horizontal rule marks a real section break, and a footnote[^1] hangs at the
bottom of the article.

[^1]: Footnotes come from remark-gfm, which Astro enables by default.
