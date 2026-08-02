package model

type Snapshot struct {
	Slug        string   `json:"slug"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
	CoverURL    *string  `json:"cover_url,omitempty"`
	CoverAlt    *string  `json:"cover_alt,omitempty"`
}
