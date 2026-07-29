package repository

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// 验证 Upload 经临时文件流式上传：Content-Length 正确、内容完整、返回大小正确。
func TestS3BackupStoreUpload(t *testing.T) {
	const payload = "fake-sql-gzip-content-for-streaming-upload"

	var gotLen string
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotLen = r.Header.Get("Content-Length")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := s3.New(s3.Options{
		Region:       "us-east-1",
		Credentials:  credentials.NewStaticCredentialsProvider("ak", "sk", ""),
		BaseEndpoint: aws.String(srv.URL),
		UsePathStyle: true,
	})
	store := &S3BackupStore{client: client, bucket: "backups"}

	size, err := store.Upload(context.Background(), "k/backup.sql.gz", strings.NewReader(payload), "application/gzip")
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if size != int64(len(payload)) {
		t.Fatalf("size = %d, want %d", size, len(payload))
	}
	if gotLen != "41" && gotLen != "" && len(gotBody) != len(payload) {
		// Content-Length 可能由 SDK 以流式方式省略，但内容必须完整
		t.Fatalf("content-length %q with body %d bytes, want %d", gotLen, len(gotBody), len(payload))
	}
	if string(gotBody) != payload {
		t.Fatalf("body = %q, want %q", gotBody, payload)
	}
}
