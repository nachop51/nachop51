package deploy

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/nachop51/nachop51/ent"
	"github.com/nachop51/nachop51/ent/deployment"
	"github.com/nachop51/nachop51/ent/post"
	"github.com/nachop51/nachop51/internal/posts"
)

type Service struct {
	SiteDir     string
	ContentDir  string
	postService *posts.Service
	db          *ent.Client

	mu         sync.Mutex
	running    bool
	startedAt  time.Time
	lastResult *Result
}

func NewService(siteDir, contentDir string, db *ent.Client, postService *posts.Service) (*Service, error) {
	if db == nil {
		return nil, errors.New("deploy: dbore is nil")
	}
	if siteDir == "" {
		return nil, errors.New("deploy: site directory is empty (SITE_DIR)")
	}

	if contentDir == "" {
		return nil, errors.New("deploy: content directory is empty")
	}

	abs, err := filepath.Abs(siteDir)
	if err != nil {
		return nil, fmt.Errorf("deploy: resolving SiteDir: %w", err)
	}
	if fi, err := os.Stat(abs); err != nil {
		return nil, fmt.Errorf("deploy: SiteDir %s: %w", abs, err)
	} else if !fi.IsDir() {
		return nil, fmt.Errorf("deploy: SiteDir %s is not a directory", abs)
	}
	siteDir = abs

	contentAbs := filepath.Join(abs, contentDir)

	if !strings.Contains(contentAbs, siteDir) || strings.Contains(contentAbs, "..") {
		return nil, fmt.Errorf("deploy: content directory %s is not inside site directory %s", contentAbs, siteDir)
	}

	return &Service{SiteDir: siteDir, ContentDir: contentAbs, db: db, postService: postService}, nil
}

func (s *Service) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()

	status := Status{Running: s.running, Last: s.lastResult}
	if s.running {
		started := s.startedAt
		status.Since = &started
	}

	return status
}

func (s *Service) RecordDeploy(ctx context.Context, at time.Time, deployErr error) error {
	c := s.db.Deployment.Create().SetCreatedAt(at).SetOk(deployErr == nil)
	if deployErr != nil {
		c.SetError(deployErr.Error())
	}
	return c.Exec(ctx)
}

func (s *Service) HasPendingSince(ctx context.Context, since time.Time) (bool, error) {
	return s.db.Post.Query().
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

func (s *Service) LastDeploy(ctx context.Context) (time.Time, error) {
	d, err := s.db.Deployment.Query().
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
