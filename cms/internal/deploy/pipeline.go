package deploy

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/nachop51/nachop51/internal/export"
)

func (d *Deployer) pipeline(ctx context.Context) error {
	if err := d.export(ctx); err != nil {
		return err
	}
	if err := d.build(ctx); err != nil {
		return err
	}
	return d.upload(ctx)
}

func (d *Deployer) export(ctx context.Context) error {
	posts, err := d.store.ListPublished(ctx)
	if err != nil {
		return fmt.Errorf("listing published posts: %w", err)
	}
	if err := export.Run(d.contentPath(), posts); err != nil {
		return fmt.Errorf("exporting posts: %w", err)
	}
	return nil
}

func (d *Deployer) build(ctx context.Context) error {
	return d.exec(ctx, "bun", "run", "build")
}

func (d *Deployer) upload(ctx context.Context) error {
	return d.exec(ctx, "bunx", "wrangler", "deploy", "dist", "--project-name", d.cfg.Project)
}

func (d *Deployer) contentPath() string {
	return filepath.Join(d.cfg.SiteDir, d.cfg.ContentDir)
}

func (d *Deployer) exec(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = d.cfg.SiteDir

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %s: %w\n%s", name, strings.Join(args, " "), err, out)
	}
	return nil
}
