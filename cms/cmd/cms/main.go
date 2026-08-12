package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"entgo.io/ent/dialect"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	_ "github.com/lib/pq"
	"github.com/nachop51/nachop51/ent"
	"github.com/nachop51/nachop51/internal/deploy"
	"github.com/nachop51/nachop51/internal/store"
	"github.com/nachop51/nachop51/internal/web"
)

type Json map[string]interface{}

func parseID(c *echo.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, Json{"error": "invalid id"})
		return uuid.Nil, false
	}
	return id, true
}

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

	if err := client.Schema.Create(context.Background()); err != nil {
		log.Fatalf("failed creating schema resources: %v", err)
	}
	log.Println("Migrations ran")

	st := store.New(client)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	e := echo.New()

	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())

	e.GET("/api/posts", func(c *echo.Context) error {
		posts, err := st.List(c.Request().Context())
		if err != nil {
			log.Printf("failed listing posts: %v", err)
			return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong fetching the posts"})
		}

		return c.JSON(http.StatusOK, posts)
	})

	e.PUT("/api/posts/:id", func(c *echo.Context) error {
		id, ok := parseID(c)
		if !ok {
			return nil
		}

		var d store.Draft
		if err := c.Bind(&d); err != nil {
			return c.JSON(http.StatusBadRequest, Json{"error": "invalid request body"})
		}
		d.ID = id

		if d.Title == "" || d.Content == "" || d.Lang == "" || d.Slug == "" {
			return c.JSON(http.StatusBadRequest, Json{"error": "title, content, lang and slug are required"})
		}

		if err := st.Save(c.Request().Context(), d); err != nil {
			log.Printf("failed saving post: %v", err)
			return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong saving the post"})
		}

		return c.NoContent(http.StatusNoContent)
	})

	e.GET("/api/posts/:id", func(c *echo.Context) error {
		id, ok := parseID(c)
		if !ok {
			return nil
		}

		p, err := st.ByID(c.Request().Context(), id)
		if ent.IsNotFound(err) {
			return c.JSON(http.StatusNotFound, Json{"error": "post not found"})
		}
		if err != nil {
			log.Printf("failed fetching post: %v", err)
			return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong fetching the post"})
		}

		return c.JSON(http.StatusOK, p)
	})

	e.POST("/api/posts/:id/unpublish", func(c *echo.Context) error {
		id, ok := parseID(c)
		if !ok {
			return nil
		}

		if err := st.Unpublish(c.Request().Context(), id); err != nil {
			log.Printf("failed unpublishing post: %v", err)
			return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong unpublishing the post"})
		}

		return c.NoContent(http.StatusOK)
	})

	e.POST("/api/posts/:id/publish", func(c *echo.Context) error {
		id, ok := parseID(c)
		if !ok {
			return nil
		}

		var body struct {
			At *time.Time `json:"at"`
		}
		if err := c.Bind(&body); err != nil {
			return c.JSON(http.StatusBadRequest, Json{"error": "invalid request body"})
		}

		at := time.Now()

		if body.At != nil {
			at = *body.At
		}

		if err := st.Publish(c.Request().Context(), id, at); err != nil {
			log.Printf("failed publishing post: %v", err)
			return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong publishing the post"})
		}

		return c.NoContent(http.StatusOK)
	})

	dep, err := deploy.New(deploy.Config{
		SiteDir:    os.Getenv("SITE_DIR"),
		ContentDir: "src/content/blog",
		Project:    os.Getenv("CF_PROJECT"),
	}, st)

	if err != nil {
		log.Fatalf("failed creating deployer: %v", err)
	}

	e.POST("/api/deploy", func(c *echo.Context) error {
		err := dep.Run(ctx)

		if errors.Is(err, deploy.ErrBusy) {
			return c.JSON(http.StatusConflict, Json{"error": "deployment already in progress"})
		}
		return c.NoContent(http.StatusAccepted)
	})

	e.GET("/api/deploy", func(c *echo.Context) error {
		return c.JSON(http.StatusOK, dep.Status())
	})

	sub, err := web.FS()
	if err != nil {
		log.Fatalf("failed to get web fs: %v", err)
	}
	handler := http.FileServer(http.FS(sub))

	e.GET("/*", func(c *echo.Context) error {
		path := strings.TrimPrefix(c.Request().URL.Path, "/")
		fmt.Printf("path: %s\n\n", path)
		if _, err := fs.Stat(sub, path); err != nil {
			c.Request().URL.Path = "/"
		}
		handler.ServeHTTP(c.Response(), c.Request())
		return nil
	})

	sch := deploy.NewScheduler(dep, 10*time.Minute)

	go sch.Run(ctx)

	sc := echo.StartConfig{Address: ":1234", GracefulTimeout: 10 * time.Second}
	if err := sc.Start(ctx, e); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("failed to start server: %v", err)
	}
}
