package files

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	tm "github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/nachop51/nachop51/ent"
)

type Service struct {
	client       *tm.Client
	db           *ent.Client
	bucket       string
	publicDomain string
}

func NewService(ctx context.Context, db *ent.Client) (*Service, error) {
	accountID := os.Getenv("R2_ACCOUNT_ID")
	accessKey := os.Getenv("R2_ACCESS_KEY")
	secret := os.Getenv("R2_SECRET_KEY")
	bucket := os.Getenv("R2_BUCKET")
	publicDomain := os.Getenv("R2_PUBLIC_DOMAIN")

	if accountID == "" || accessKey == "" || secret == "" || bucket == "" || publicDomain == "" {
		return nil, fmt.Errorf("storage: missing required environment variables")
	}

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("auto"),
		config.WithCredentialsProvider(aws.CredentialsProviderFunc(
			func(ctx context.Context) (aws.Credentials, error) {
				return aws.Credentials{AccessKeyID: accessKey, SecretAccessKey: secret}, nil
			},
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("storage: loading config: %w", err)
	}

	s3client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID))
	})

	c := tm.New(s3client)

	return &Service{
		client:       c,
		db:           db,
		bucket:       bucket,
		publicDomain: publicDomain,
	}, nil
}

type Uploaded struct {
	Key string
	URL string
}

func (s *Service) Upload(ctx context.Context, r io.Reader, contentType, key string) (*Uploaded, error) {
	_, err := s.client.UploadObject(ctx, &tm.UploadObjectInput{
		Bucket:       &s.bucket,
		Key:          &key,
		Body:         r,
		ContentType:  &contentType,
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	})
	if err != nil {
		return nil, fmt.Errorf("storage: uploading object: %w", err)
	}

	return &Uploaded{
		Key: key,
		URL: s.publicDomain + "/" + key,
	}, nil
}

func (s *Service) SaveAsset(ctx context.Context, info AssetInfo) (*ent.Asset, error) {
	return s.db.Asset.Create().
		SetID(info.ID).
		SetKey(info.Key).
		SetURL(info.URL).
		SetOriginalName(info.OriginalName).
		SetContentType(info.ContentType).
		SetSize(info.Size).
		Save(ctx)
}
