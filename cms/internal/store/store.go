package store

import (
	"context"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"
	"entgo.io/ent/dialect/sql/sqljson"
	"github.com/google/uuid"
	"github.com/nachop51/nachop51/ent"
	"github.com/nachop51/nachop51/ent/deployment"
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
	tx, err := s.c.Tx(ctx)
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
		SetStateChangedAt(time.Now()).
		Exec(ctx)
}

func (s *Store) Unpublish(ctx context.Context, id uuid.UUID) error {
	return s.c.Post.UpdateOneID(id).
		ClearPublishedSnapshot().
		ClearPublishedAt().
		SetStateChangedAt(time.Now()).
		Exec(ctx)
}

func (s *Store) ListPublished(ctx context.Context) ([]*ent.Post, error) {
	return s.c.Post.Query().
		Where(post.PublishedAtNotNil(), post.PublishedAtLTE(time.Now())).
		Order(ent.Desc(post.FieldPublishedAt)).
		All(ctx)
}

func (s *Store) HasPendingSince(ctx context.Context, since time.Time) (bool, error) {
	return s.c.Post.Query().
		Where(
			post.Or(
				post.And(
					post.StateChangedAtNotNil(),
					post.UpdatedAtGTE(since),
				),
				post.And(
					post.PublishedAtNotNil(),
					post.PublishedAtLTE(time.Now()),
					post.PublishedAtGTE(since),
				),
			),
		).
		Exist(ctx)
}

func (s *Store) LastDeploy(ctx context.Context) (time.Time, error) {
	d, err := s.c.Deployment.Query().
		Where(deployment.Ok(true)).
		Order(ent.Desc(deployment.FieldCreatedAt)).
		First(ctx)

	if ent.IsNotFound(err) {
		return time.Time{}, nil
	}

	if err != nil {
		return time.Time{}, err
	}

	return d.CreatedAt, nil
}

func (s *Store) RecordDeploy(ctx context.Context, at time.Time, deployErr error) error {
	c := s.c.Deployment.Create().SetCreatedAt(at).SetOk(deployErr == nil)
	if deployErr != nil {
		c.SetError(deployErr.Error())
	}
	return c.Exec(ctx)
}
