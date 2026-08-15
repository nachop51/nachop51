package deploy

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/labstack/echo/v5"
)

type Json map[string]any

type Handler struct {
	svc *Service
	ctx context.Context // server-lifetime ctx for async runs
}

func NewHandler(ctx context.Context, svc *Service) *Handler {
	return &Handler{svc: svc, ctx: ctx}
}

func (h *Handler) RegisterRoutes(e *echo.Echo) {
	g := e.Group("/api")
	g.POST("/deploy", h.run)
	g.GET("/deploy", h.status)
	g.POST("/export", h.export)
}

func (h *Handler) run(c *echo.Context) error {
	if err := h.svc.Run(h.ctx); errors.Is(err, ErrBusy) {
		return echo.NewHTTPError(http.StatusConflict, "deployment already in progress")
	}

	return c.NoContent(http.StatusAccepted)
}

func (h *Handler) status(c *echo.Context) error {
	return c.JSON(http.StatusOK, h.svc.Status())
}

func (h *Handler) export(c *echo.Context) error {
	posts, err := h.svc.postService.ListPublished(c.Request().Context())
	if err != nil {
		log.Printf("failed listing published posts: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "something went wrong fetching the published posts")
	}

	runExport(h.svc.ContentDir, posts)

	return c.JSON(http.StatusOK, Json{"message": "exported successfully"})
}
