package deploy

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"time"
)

var ErrBusy = errors.New("deploy: already running")

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

func (d *Service) acquire() bool {
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

func (d *Service) release(err error) *Result {
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

func (d *Service) execute(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)

	cmd.Dir = d.SiteDir

	out, err := cmd.CombinedOutput()

	if err != nil {
		return fmt.Errorf("deploy: executing '%s %v': %w\n%s", name, strings.Join(args, " "), err, string(out))
	}

	return nil
}

func (d *Service) deploy(ctx context.Context) error {
	posts, err := d.postService.ListPublished(ctx)
	if err != nil {
		return fmt.Errorf("deploy: listing published posts: %w", err)
	}

	err = runExport(d.ContentDir, posts)

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
func (d *Service) Run(ctx context.Context) error {
	if !d.acquire() {
		return ErrBusy
	}

	go func() {
		depErr := d.deploy(ctx)
		r := d.release(depErr)

		if depErr != nil {
			log.Printf("deploy: %v", depErr)
		}

		if err := d.RecordDeploy(ctx, r.At, depErr); err != nil {
			log.Printf("deploy: recording deploy: %v", err)
		}
	}()

	return nil
}
