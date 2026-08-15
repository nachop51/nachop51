package posts

import (
	"log"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/nachop51/nachop51/ent"
)

type Json map[string]any

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(e *echo.Echo) {
	g := e.Group("/api/posts")
	g.GET("", h.list)
	g.GET("/:id", h.get)
	g.PUT("/:id", h.save)
	g.POST("/:id/publish", h.publish)
	g.POST("/:id/unpublish", h.unpublish)
}

func (h *Handler) list(c *echo.Context) error {
	posts, err := h.svc.List(c.Request().Context())
	if err != nil {
		log.Printf("failed listing posts: %v", err)
		return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong fetching the posts"})
	}

	return c.JSON(http.StatusOK, posts)
}

func parseID(c *echo.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, Json{"error": "invalid id"})
		return uuid.Nil, false
	}
	return id, true
}

func (h *Handler) get(c *echo.Context) error {
	id, ok := parseID(c)
	if !ok {
		return nil
	}

	p, err := h.svc.Get(c.Request().Context(), id)
	if ent.IsNotFound(err) {
		return c.JSON(http.StatusNotFound, Json{"error": "post not found"})
	}
	if err != nil {
		log.Printf("failed fetching post: %v", err)
		return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong fetching the post"})
	}

	return c.JSON(http.StatusOK, p)
}

func (h *Handler) save(c *echo.Context) error {
	id, ok := parseID(c)
	if !ok {
		return nil
	}

	var d Draft
	if err := c.Bind(&d); err != nil {
		return c.JSON(http.StatusBadRequest, Json{"error": "invalid request body"})
	}
	d.ID = id

	if d.Title == "" || d.Content == "" || d.Lang == "" || d.Slug == "" {
		return c.JSON(http.StatusBadRequest, Json{"error": "title, content, lang and slug are required"})
	}

	if slices.Contains([]string{"en", "es"}, d.Lang) == false {
		return c.JSON(http.StatusBadRequest, Json{"error": "lang must be one of: en, es"})
	}

	if err := h.svc.Save(c.Request().Context(), d); err != nil {
		log.Printf("failed saving post: %v", err)
		return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong saving the post"})
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) publish(c *echo.Context) error {
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

	if err := h.svc.Publish(c.Request().Context(), id, at); err != nil {
		log.Printf("failed publishing post: %v", err)
		return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong publishing the post"})
	}

	return c.NoContent(http.StatusOK)

}

func (h *Handler) unpublish(c *echo.Context) error {
	id, ok := parseID(c)
	if !ok {
		return nil
	}

	if err := h.svc.Unpublish(c.Request().Context(), id); err != nil {
		log.Printf("failed unpublishing post: %v", err)
		return c.JSON(http.StatusInternalServerError, Json{"error": "something went wrong unpublishing the post"})
	}

	return c.NoContent(http.StatusOK)

}
