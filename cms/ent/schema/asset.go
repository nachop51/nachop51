package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// Asset holds the schema definition for the Asset entity.
type Asset struct {
	ent.Schema
}

// Fields of the Asset.
func (Asset) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),

		field.String("key").Immutable(),
		field.String("url").Immutable(),

		field.String("original_name").Default(""),
		field.String("content_type").Immutable(),
		field.Int64("size").NonNegative(),

		field.Time("created_at").Default(time.Now).Immutable(),
	}
}

func (Asset) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("created_at"),
	}
}

// Edges of the Asset.
func (Asset) Edges() []ent.Edge {
	return nil
}
