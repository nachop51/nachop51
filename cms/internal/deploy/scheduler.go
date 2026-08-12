package deploy

import (
	"context"
	"errors"
	"log"
	"time"
)

type Scheduler struct {
	Interval time.Duration
	dep      *Deployer
}

func NewScheduler(dep *Deployer, interval time.Duration) *Scheduler {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	return &Scheduler{Interval: interval, dep: dep}
}

func (s *Scheduler) Run(ctx context.Context) {
	ticker := time.NewTicker(s.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.tick(ctx); err != nil {
				log.Printf("scheduler: %v", err)
			}
		}
	}
}

func (s *Scheduler) tick(ctx context.Context) error {
	last, err := s.dep.store.LastDeploy(ctx)
	if err != nil {
		return err
	}

	pending, err := s.dep.store.HasPendingSince(ctx, last)
	if err != nil {
		return err
	}
	if !pending {
		return nil
	}

	log.Printf("scheduler: pending changes found, starting deployment")

	err = s.dep.Run(ctx)
	if errors.Is(err, ErrBusy) {
		return nil
	}
	return err
}
