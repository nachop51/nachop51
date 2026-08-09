package deploy

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/nachop51/nachop51/internal/store"
)

var ErrBusy = errors.New("deploy already running")

type Config struct {
	SiteDir    string        // Astro site root
	ContentDir string        // content collection, relative to SiteDir
	Project    string        // Cloudflare Pages project name
	Interval   time.Duration // how often the scheduler checks for pending posts
}

type Result struct {
	OK       bool          `json:"ok"`
	Error    string        `json:"error,omitempty"`
	At       time.Time     `json:"at"`
	Duration time.Duration `json:"duration"`
}

type Status struct {
	Running bool       `json:"running"`
	Since   *time.Time `json:"since,omitempty"`
	Last    *Result    `json:"last,omitempty"`
}

type Deployer struct {
	cfg   Config
	store *store.Store

	mu        sync.Mutex
	running   bool
	startedAt time.Time
	last      *Result
}

func New(cfg Config, st *store.Store) (*Deployer, error) {
	if st == nil {
		return nil, errors.New("deploy: store is required")
	}
	if cfg.SiteDir == "" {
		return nil, errors.New("deploy: SiteDir is required (set SITE_DIR)")
	}
	if cfg.ContentDir == "" {
		return nil, errors.New("deploy: ContentDir is required")
	}
	if cfg.Project == "" {
		return nil, errors.New("deploy: Project is required (set CF_PROJECT)")
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 5 * time.Minute
	}

	abs, err := filepath.Abs(cfg.SiteDir)
	if err != nil {
		return nil, fmt.Errorf("deploy: resolving SiteDir: %w", err)
	}
	if fi, err := os.Stat(abs); err != nil {
		return nil, fmt.Errorf("deploy: SiteDir %s: %w", abs, err)
	} else if !fi.IsDir() {
		return nil, fmt.Errorf("deploy: SiteDir %s is not a directory", abs)
	}
	cfg.SiteDir = abs

	return &Deployer{cfg: cfg, store: st}, nil
}

func (d *Deployer) Status() Status {
	d.mu.Lock()
	defer d.mu.Unlock()

	s := Status{Running: d.running, Last: d.last}
	if d.running {
		started := d.startedAt
		s.Since = &started
	}
	return s
}

func (d *Deployer) Trigger(ctx context.Context) error {
	started, err := d.claim()
	if err != nil {
		return err
	}
	return d.run(ctx, started)
}

func (d *Deployer) TriggerAsync() error {
	started, err := d.claim()
	if err != nil {
		return err
	}
	go func() {
		if err := d.run(context.Background(), started); err != nil {
			log.Printf("deploy: %v", err)
		}
	}()
	return nil
}

func (d *Deployer) Export(ctx context.Context) error {
	if _, err := d.claim(); err != nil {
		return err
	}
	defer d.unclaim()

	return d.export(ctx)
}

func (d *Deployer) Run(ctx context.Context) {
	t := time.NewTicker(d.cfg.Interval)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := d.tick(ctx); err != nil && !errors.Is(err, ErrBusy) {
				log.Printf("deploy: scheduled run failed: %v", err)
			}
		}
	}
}

func (d *Deployer) tick(ctx context.Context) error {
	last, err := d.store.LastDeploy(ctx)
	if err != nil {
		return fmt.Errorf("reading last deploy: %w", err)
	}

	pending, err := d.store.HasPendingSince(ctx, last)
	if err != nil {
		return fmt.Errorf("checking for pending posts: %w", err)
	}
	if !pending {
		return nil
	}

	log.Printf("deploy: posts published since %s, deploying", last.Format(time.RFC3339))
	return d.Trigger(ctx)
}

func (d *Deployer) run(ctx context.Context, started time.Time) error {
	err := d.pipeline(ctx)
	d.finish(started, err)

	if recErr := d.store.RecordDeploy(context.WithoutCancel(ctx), started, err); recErr != nil {
		log.Printf("deploy: failed recording deployment: %v", recErr)
	}
	return err
}

func (d *Deployer) claim() (time.Time, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.running {
		return time.Time{}, ErrBusy
	}
	d.running, d.startedAt = true, time.Now()
	return d.startedAt, nil
}

func (d *Deployer) unclaim() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.running = false
}

func (d *Deployer) finish(started time.Time, err error) {
	res := &Result{OK: err == nil, At: started, Duration: time.Since(started)}
	if err != nil {
		res.Error = err.Error()
	}

	d.mu.Lock()
	defer d.mu.Unlock()
	d.running, d.last = false, res
}
