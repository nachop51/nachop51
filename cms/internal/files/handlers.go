package files

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

type Json map[string]any

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(e *echo.Echo) {
	g := e.Group("/api/upload")
	g.POST("", h.upload)
}

func (h *Handler) upload(c *echo.Context) error {
	file, err := c.FormFile("file")

	if err != nil {
		return c.JSON(http.StatusBadRequest, Json{"error": "missing file field"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, Json{"error": "failed to open file"})
	}
	defer src.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(src, head)
	contentType := http.DetectContentType(head[:n])

	ext, ok := allowedTypes[contentType]
	if !ok {
		return c.JSON(http.StatusUnsupportedMediaType, Json{"error": fmt.Sprintf("type %s not allowed", contentType)})
	}

	body := io.MultiReader(bytes.NewReader(head[:n]), src)

	id := uuid.New()
	key := id.String() + ext

	up, err := h.svc.Upload(c.Request().Context(), body, contentType, key)
	if err != nil {
		log.Printf("failed uploading file: %v", err)
		return c.JSON(http.StatusInternalServerError, Json{"error": "failed to upload file"})
	}

	a, err := h.svc.SaveAsset(c.Request().Context(), AssetInfo{
		ID:           id,
		Key:          up.Key,
		URL:          up.URL,
		OriginalName: file.Filename,
		ContentType:  contentType,
		Size:         file.Size,
	})

	if err != nil {
		log.Printf("failed saving asset: %v", err)
		return c.JSON(http.StatusInternalServerError, Json{"error": "failed to save asset"})
	}

	return c.JSON(http.StatusOK, a)

}
