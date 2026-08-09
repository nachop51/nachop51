package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// Deployment holds the schema definition for the Deployment entity.
type Deployment struct {
	ent.Schema
}

// Fields of the Deployment.
func (Deployment) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Bool("ok").Default(false),
		field.Text("error").Default(""),
	}
}

func (Deployment) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("created_at"),
	}
}

// Edges of the Deployment.
func (Deployment) Edges() []ent.Edge {
	return nil
}
