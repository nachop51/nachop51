package deploy

import (
	"context"
	"errors"
	"log"
	"time"
)

type Scheduler struct {
	Interval time.Duration
	svc      *Service
}

func NewScheduler(svc *Service, interval time.Duration) *Scheduler {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	return &Scheduler{Interval: interval, svc: svc}
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
	last, err := s.svc.LastDeploy(ctx)
	if err != nil {
		return err
	}

	pending, err := s.svc.HasPendingSince(ctx, last)
	if err != nil {
		return err
	}
	if !pending {
		return nil
	}

	log.Printf("scheduler: pending changes found, starting deployment")

	err = s.svc.Run(ctx)
	if errors.Is(err, ErrBusy) {
		return nil
	}
	return err
}
