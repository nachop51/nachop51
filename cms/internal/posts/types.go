package posts

import "github.com/google/uuid"

type Draft struct {
	ID          uuid.UUID `json:"id"`
	Lang        string    `json:"lang"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Content     string    `json:"content"`
	Tags        []string  `json:"tags"`
}
