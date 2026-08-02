package export

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/nachop51/nachop51/ent"
	"gopkg.in/yaml.v3"
)

type frontmatter struct {
	Title          string   `yaml:"title"`
	Description    string   `yaml:"description"`
	PubDate        string   `yaml:"pubDate"`
	UpdatedDate    string   `yaml:"updatedDate,omitempty"`
	Tags           []string `yaml:"tags,omitempty"`
	TranslationKey string   `yaml:"translationKey,omitempty"`
	Cover          string   `yaml:"cover,omitempty"`
	CoverAlt       string   `yaml:"coverAlt,omitempty"`
	OldSlugs       []string `yaml:"oldSlugs,omitempty"`
}

func Run(contentDir string, posts []*ent.Post) error {
	if err := os.RemoveAll(contentDir); err != nil {
		return err
	}

	for _, p := range posts {
		if p.PublishedSnapshot == nil {
			continue
		}
		if err := writePost(contentDir, p); err != nil {
			return fmt.Errorf("post %s: %w", p.ID, err)
		}
	}
	return nil
}

func writePost(contentDir string, p *ent.Post) error {
	s := p.PublishedSnapshot

	fm := frontmatter{
		Title:       s.Title,
		Description: s.Description,
		PubDate:     p.PublishedAt.Format(time.RFC3339),
		Tags:        s.Tags,
		OldSlugs:    p.OldSlugs,
	}

	if p.TranslationKey != nil {
		fm.TranslationKey = *p.TranslationKey
	}
	if s.CoverURL != nil {
		fm.Cover = *s.CoverURL
	}
	if s.CoverAlt != nil {
		fm.CoverAlt = *s.CoverAlt
	}

	head, err := yaml.Marshal(fm)

	if err != nil {
		return err
	}

	body := []byte("---\n" + string(head) + "---\n\n" + s.Content)

	dir := filepath.Join(contentDir, p.Lang)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(dir, s.Slug+".md"), body, 0o644)
}
