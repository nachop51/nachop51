package web

import (
	"io/fs"
	"net/http"
)

type Service struct {
	sub        fs.FS
	fileServer http.Handler
}

func NewService() (*Service, error) {
	sub, err := FS()
	if err != nil {
		return nil, err
	}
	handler := http.FileServer(http.FS(sub))
	return &Service{sub: sub, fileServer: handler}, nil
}
