package posts

import (
	"context"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"
	"entgo.io/ent/dialect/sql/sqljson"
	"github.com/google/uuid"
	"github.com/nachop51/nachop51/ent"
	"github.com/nachop51/nachop51/ent/post"
	"github.com/nachop51/nachop51/internal/model"
)

type Service struct {
	db *ent.Client
}

func NewService(db *ent.Client) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context) ([]*ent.Post, error) {
	return s.db.Post.Query().
		Order(ent.Desc(post.FieldUpdatedAt)).
		All(ctx)
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (*ent.Post, error) {
	return s.db.Post.Get(ctx, id)
}

func (s *Service) Save(ctx context.Context, d Draft) error {
	tx, err := s.db.Tx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	existing, err := tx.Post.Get(ctx, d.ID)

	if ent.IsNotFound(err) {
		err := tx.Post.Create().
			SetID(d.ID).
			SetLang(d.Lang).
			SetSlug(d.Slug).
			SetTitle(d.Title).
			SetDescription(d.Description).
			SetContent(d.Content).
			SetTags(d.Tags).
			Exec(ctx)

		if err != nil {
			return err
		}

		return tx.Commit()
	}

	if err != nil {
		return err
	}

	oldSlugs := existing.OldSlugs

	if existing.Slug != d.Slug {
		taken, err := tx.Post.Query().
			Where(
				post.Lang(existing.Lang),
				post.IDNEQ(d.ID),
				post.Or(
					post.Slug(d.Slug),
					func(sel *entsql.Selector) {
						sel.Where(sqljson.ValueContains(post.FieldOldSlugs, d.Slug))
					},
				),
			).
			Exist(ctx)
		if err != nil {
			return err
		}
		if taken {
			return fmt.Errorf("slug %q is already taken by another post", d.Slug)
		}

		if existing.PublishedAt != nil {
			next := make([]string, 0, len(existing.OldSlugs)+1)
			for _, s := range existing.OldSlugs {
				if s != d.Slug {
					next = append(next, s)
				}
			}
			oldSlugs = append(next, existing.Slug)
		}
	}

	err = tx.Post.UpdateOne(existing).
		SetSlug(d.Slug).
		SetTitle(d.Title).
		SetDescription(d.Description).
		SetContent(d.Content).
		SetTags(d.Tags).
		SetOldSlugs(oldSlugs).
		Exec(ctx)

	if err != nil {
		return err
	}

	return tx.Commit()

}

func (s *Service) Publish(ctx context.Context, id uuid.UUID, at time.Time) error {
	p, err := s.db.Post.Get(ctx, id)
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

	return s.db.Post.UpdateOneID(id).
		SetPublishedSnapshot(snap).
		SetPublishedAt(at).
		SetStateChangedAt(time.Now()).
		Exec(ctx)
}

func (s *Service) Unpublish(ctx context.Context, id uuid.UUID) error {
	return s.db.Post.UpdateOneID(id).
		ClearPublishedSnapshot().
		ClearPublishedAt().
		SetStateChangedAt(time.Now()).
		Exec(ctx)
}

func (s *Service) ListPublished(ctx context.Context) ([]*ent.Post, error) {
	return s.db.Post.Query().
		Where(post.PublishedAtNotNil(), post.PublishedAtLTE(time.Now())).
		Order(ent.Desc(post.FieldPublishedAt)).
		All(ctx)
}
