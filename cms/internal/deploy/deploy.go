package deploy

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/nachop51/nachop51/internal/export"
	"github.com/nachop51/nachop51/internal/store"
)

var ErrBusy = errors.New("deploy: already running")

type Config struct {
	SiteDir    string // astro project location
	ContentDir string // relative to site, where is the content directory
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

	mu         sync.Mutex
	running    bool
	startedAt  time.Time
	lastResult *Result
}

func New(cfg Config, st *store.Store) (*Deployer, error) {
	if st == nil {
		return nil, errors.New("deploy: store is nil")
	}
	if cfg.SiteDir == "" {
		return nil, errors.New("deploy: site directory is empty (SITE_DIR)")
	}

	if cfg.ContentDir == "" {
		return nil, errors.New("deploy: content directory is empty")
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

	contentAbs := filepath.Join(abs, cfg.ContentDir)

	if !strings.Contains(contentAbs, cfg.SiteDir) || strings.Contains(contentAbs, "..") {
		return nil, fmt.Errorf("deploy: content directory %s is not inside site directory %s", contentAbs, cfg.SiteDir)
	}

	cfg.ContentDir = contentAbs

	return &Deployer{cfg: cfg, store: st}, nil
}

func (d *Deployer) Status() Status {
	d.mu.Lock()
	defer d.mu.Unlock()

	status := Status{Running: d.running, Last: d.lastResult}
	if d.running {
		started := d.startedAt
		status.Since = &started
	}

	return status
}

func (d *Deployer) acquire() bool {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.running {
		return false
	}

	d.running = true
	d.startedAt = time.Now()
	d.lastResult = nil

	return true
}

func (d *Deployer) release(err error) *Result {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.running = false

	r := &Result{OK: err == nil, At: d.startedAt, Duration: time.Since(d.startedAt)}

	if err != nil {
		r.Error = err.Error()
	}

	d.lastResult = r
	return r
}

func (d *Deployer) execute(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)

	cmd.Dir = d.cfg.SiteDir

	out, err := cmd.CombinedOutput()

	if err != nil {
		return fmt.Errorf("deploy: executing '%s %v': %w\n%s", name, strings.Join(args, " "), err, string(out))
	}

	return nil
}

func (d *Deployer) deploy(ctx context.Context) error {
	posts, err := d.store.ListPublished(ctx)
	if err != nil {
		return fmt.Errorf("deploy: listing published posts: %w", err)
	}

	err = export.Run(d.cfg.ContentDir, posts)

	if err != nil {
		return fmt.Errorf("deploy: exporting content: %w", err)
	}

	err = d.execute(ctx, "bunx", "void", "deploy", "--project", "nachop51")

	if err != nil {
		return err
	}

	return nil
}

// run executes the whole deploy process, including acquiring the lock, deploying, releasing the lock and recording the result in the store.
// then returns the error of the deploy process, if any. If the deployer is already running, it returns ErrBusy.
func (d *Deployer) Run(ctx context.Context) error {
	if !d.acquire() {
		return ErrBusy
	}

	go func() {
		depErr := d.deploy(ctx)
		r := d.release(depErr)

		if depErr != nil {
			log.Printf("deploy: %v", depErr)
		}

		if err := d.store.RecordDeploy(ctx, r.At, depErr); err != nil {
			log.Printf("deploy: recording deploy: %v", err)
		}
	}()

	return nil
}
