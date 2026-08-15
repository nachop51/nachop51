package files

import "github.com/google/uuid"

type AssetInfo struct {
	ID           uuid.UUID `json:"id"`
	Key          string    `json:"key"`
	URL          string    `json:"url"`
	OriginalName string    `json:"original_name"`
	ContentType  string    `json:"content_type"`
	Size         int64     `json:"size"`
}

var allowedTypes = map[string]string{
	"text/plain":      ".txt",
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"image/gif":       ".gif",
	"image/avif":      ".avif",
	"video/mp4":       ".mp4",
	"video/webm":      ".webm",
	"audio/mpeg":      ".mp3",
	"application/pdf": ".pdf",
	"application/zip": ".zip",
}
