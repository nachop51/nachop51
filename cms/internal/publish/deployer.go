package publish

import (
	"context"
	"fmt"
	"os/exec"
)

type Deployer struct {
	SiteDir string // Astro site directory
	Project string // Cloudflare project name
}

func (d *Deployer) run(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = d.SiteDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %v: %w\n%s", name, args, err, out)
	}
	return nil
}

func (d *Deployer) Deploy(ctx context.Context) error {
	if err := d.run(ctx, "bun", "run", "build"); err != nil {
		return err
	}
	return d.run(ctx, "bunx", "wrangler", "deploy", "dist", "--project-name", d.Project)
}
