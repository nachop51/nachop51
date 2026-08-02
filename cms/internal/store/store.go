package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/nachop51/nachop51/ent"
	"github.com/nachop51/nachop51/ent/post"
	"github.com/nachop51/nachop51/internal/model"
)

type Store struct{ c *ent.Client }

func New(c *ent.Client) *Store { return &Store{c: c} }

func (s *Store) List(ctx context.Context) ([]*ent.Post, error) {
	return s.c.Post.Query().
		Order(ent.Desc(post.FieldUpdatedAt)).
		All(ctx)
}

func (s *Store) ByID(ctx context.Context, id uuid.UUID) (*ent.Post, error) {
	return s.c.Post.Get(ctx, id)
}

type Draft struct {
	ID          uuid.UUID `json:"id"`
	Lang        string    `json:"lang"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Content     string    `json:"content"`
	Tags        []string  `json:"tags"`
}

func (s *Store) Save(ctx context.Context, d Draft) error {
	return s.c.Post.Create().
		SetID(d.ID).
		SetLang(d.Lang).
		SetSlug(d.Slug).
		SetTitle(d.Title).
		SetDescription(d.Description).
		SetContent(d.Content).
		SetTags(d.Tags).
		OnConflictColumns("id").
		Update(func(u *ent.PostUpsert) {
			u.UpdateSlug()
			u.UpdateTitle()
			u.UpdateDescription()
			u.UpdateContent()
			u.UpdateTags()
			u.SetUpdatedAt(time.Now())
		}).
		Exec(ctx)
}

func (s *Store) Publish(ctx context.Context, id uuid.UUID, at time.Time) error {
	p, err := s.c.Post.Get(ctx, id)
	if err != nil {
		return err
	}

	snap := &model.Snapshot{
		Slug:        p.Slug,
		Title:       p.Title,
		Description: p.Description,
		Content:     p.Content,
		Tags:        p.Tags,
		CoverURL:    p.CoverURL,
		CoverAlt:    p.CoverAlt,
	}

	return s.c.Post.UpdateOneID(id).
		SetPublishedSnapshot(snap).
		SetPublishedAt(at).
		Exec(ctx)
}

func (s *Store) Unpublish(ctx context.Context, id uuid.UUID) error {
	return s.c.Post.UpdateOneID(id).
		ClearPublishedSnapshot().
		ClearPublishedAt().
		Exec(ctx)
}

func (s *Store) ListPublished(ctx context.Context) ([]*ent.Post, error) {
	return s.c.Post.Query().
		Where(post.PublishedAtNotNil(), post.PublishedAtLTE(time.Now())).
		Order(ent.Desc(post.FieldPublishedAt)).
		All(ctx)
}
