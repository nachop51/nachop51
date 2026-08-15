package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"entgo.io/ent/dialect"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	_ "github.com/lib/pq"
	"github.com/nachop51/nachop51/ent"
	"github.com/nachop51/nachop51/internal/deploy"
	"github.com/nachop51/nachop51/internal/files"
	"github.com/nachop51/nachop51/internal/posts"
	"github.com/nachop51/nachop51/internal/web"
)

type Json map[string]any

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	client, err := ent.Open(dialect.Postgres, dsn)
	if err != nil {
		log.Fatalf("failed opening connection to postgres: %v", err)
	}
	defer client.Close()

	// auto migration tool
	if err := client.Schema.Create(context.Background()); err != nil {
		log.Fatalf("failed creating schema resources: %v", err)
	}
	log.Println("Migrations ran")

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	e := echo.New()

	e.Pre(middleware.RemoveTrailingSlash())
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())

	postsService := posts.NewService(client)
	postsHandler := posts.NewHandler(postsService)
	postsHandler.RegisterRoutes(e)

	filesSerivce, err := files.NewService(ctx, client, os.Getenv("R2_ACCOUNT_ID"),
		os.Getenv("R2_ACCESS_KEY"),
		os.Getenv("R2_SECRET_KEY"),
		os.Getenv("R2_BUCKET"),
		os.Getenv("R2_PUBLIC_DOMAIN"),
	)

	if err != nil {
		log.Fatalf("failed creating files service: %v", err)
	}

	filesHandler := files.NewHandler(filesSerivce)
	filesHandler.RegisterRoutes(e)

	deployService, err := deploy.NewService(
		os.Getenv("SITE_DIR"),
		"src/content/blog",
		client,
		postsService,
	)
	if err != nil {
		log.Fatalf("failed creating deploy service: %v", err)
	}

	deployHandler := deploy.NewHandler(ctx, deployService)
	deployHandler.RegisterRoutes(e)

	webService, err := web.NewService()
	if err != nil {
		log.Fatalf("failed creating web service: %v", err)
	}
	web.NewHandler(webService).RegisterRoutes(e)

	e.Any("/api/*", func(c *echo.Context) error {
		return echo.NewHTTPError(http.StatusNotFound, "not found")
	})

	// sch := deploy.NewScheduler(deployService, 10*time.Minute)
	// go sch.Run(ctx)

	sc := echo.StartConfig{Address: ":1234", GracefulTimeout: 10 * time.Second}
	if err := sc.Start(ctx, e); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("failed to start server: %v", err)
	}
}
