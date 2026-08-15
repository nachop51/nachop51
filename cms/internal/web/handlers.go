package web

import (
	"io/fs"
	"strings"

	"github.com/labstack/echo/v5"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(e *echo.Echo) {
	e.GET("/*", h.serveFrontend)
}

func (h *Handler) serveFrontend(c *echo.Context) error {
	path := strings.TrimPrefix(c.Request().URL.Path, "/")
	if _, err := fs.Stat(h.svc.sub, path); err != nil {
		c.Request().URL.Path = "/"
	}
	h.svc.fileServer.ServeHTTP(c.Response(), c.Request())
	return nil
}
