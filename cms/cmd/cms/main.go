package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"entgo.io/ent/dialect"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/nachop51/nachop51/ent"
	"github.com/nachop51/nachop51/internal/export"
	"github.com/nachop51/nachop51/internal/publish"
	"github.com/nachop51/nachop51/internal/store"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	client, err := ent.Open(dialect.Postgres, dsn)
	if err != nil {
		log.Fatalf("failed opening connection to postgres: %v", err)
	}
	defer client.Close()

	if err := client.Schema.Create(context.Background()); err != nil {
		log.Fatalf("failed creating schema resources: %v", err)
	}
	log.Println("Migrations ran")

	st := store.New(client)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/posts", func(w http.ResponseWriter, r *http.Request) {
		posts, err := st.List(r.Context())
		if err != nil {
			log.Printf("failed listing posts: %v", err)
			http.Error(w, "something went wrong fetching the posts", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(posts)
	})

	mux.HandleFunc("PUT /api/posts/{id}", func(w http.ResponseWriter, r *http.Request) {
		log.Print("here")
		id, err := uuid.Parse(r.PathValue("id"))
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}

		var d store.Draft
		if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		d.ID = id

		if err := st.Save(r.Context(), d); err != nil {
			log.Printf("failed saving post: %v", err)
			http.Error(w, "something went wrong saving the post", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})

	mux.HandleFunc("POST /api/posts/{id}/unpublish", func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(r.PathValue("id"))
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}
		if err := st.Unpublish(r.Context(), id); err != nil {
			log.Printf("failed unpublishing post: %v", err)
			http.Error(w, "something went wrong unpublishing the post", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	mux.HandleFunc("POST /api/posts/{id}/publish", func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(r.PathValue("id"))
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}

		var body struct {
			At *time.Time `json:"at"`
		}
		json.NewDecoder(r.Body).Decode(&body)

		at := time.Now()
		if body.At != nil {
			at = *body.At
		}

		if err := st.Publish(r.Context(), id, at); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("POST /api/export", func(w http.ResponseWriter, r *http.Request) {
		posts, err := st.ListPublished(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err := export.Run("content", posts); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("POST /api/publish", func(w http.ResponseWriter, r *http.Request) {
		posts, err := st.ListPublished(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		siteDir := os.Getenv("SITE_DIR")
		if err := export.Run(filepath.Join(siteDir, "src/content/blog"), posts); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}

		dep := publish.Deployer{SiteDir: siteDir, Project: os.Getenv("CF_PROJECT")}
		if err := dep.Deploy(r.Context()); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}

		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("GET /api/posts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(r.PathValue("id"))
		if err != nil {
			http.Error(w, "invalid id", http.StatusNotFound)
			return
		}
		p, err := st.ByID(r.Context(), id)
		if ent.IsNotFound(err) {
			http.Error(w, "post not found", http.StatusNotFound)
			return
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(p)
	})

	log.Println("running on localhost:1234")
	log.Fatal(http.ListenAndServe(":1234", mux))
}
