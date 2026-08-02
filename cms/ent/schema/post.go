package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
	"github.com/nachop51/nachop51/internal/model"
)

// Post holds the schema definition for the Post entity.
type Post struct {
	ent.Schema
}

// Fields of the Post.
func (Post) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),

		field.String("lang").Immutable().Default("en"),
		field.String("slug"),
		field.Strings("old_slugs").Default([]string{}),
		field.String("translation_key").Optional().Nillable(),

		field.Text("title").Default(""),
		field.Text("description").Default(""),
		field.Text("content").Default(""),
		field.Strings("tags").Default([]string{}),

		field.String("cover_url").Optional().Nillable(),
		field.String("cover_alt").Optional().Nillable(),

		field.Time("published_at").Optional().Nillable(),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),

		field.JSON("published_snapshot", &model.Snapshot{}).Optional(),
	}
}

func (Post) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("lang", "slug").Unique(),
		index.Fields("translation_key", "lang").Unique().
			Annotations(entsql.IndexWhere("translation_key IS NOT NULL")),
		index.Fields("published_at"),
	}
}

func (Post) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{
			Checks: map[string]string{
				"lang_valid":  "lang IN ('en', 'es')",
				"publishable": "published_at IS NULL OR (title <> '' AND description <> '' AND slug <> '' AND content <> '')",
			},
		},
	}
}

// Edges of the Post.
func (Post) Edges() []ent.Edge {
	return nil
}
