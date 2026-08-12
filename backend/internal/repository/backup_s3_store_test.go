//go:build unit

package repository

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/stretchr/testify/require"
)

// 验证 Upload 经临时文件流式上传：Content-Length 正确、内容完整、返回大小正确。
func TestS3BackupStoreUpload(t *testing.T) {
	const payload = "fake-sql-gzip-content-for-streaming-upload"

	var gotContentLength int64
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotContentLength = r.ContentLength
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
	if gotContentLength != int64(len(payload)) {
		t.Fatalf("Content-Length = %d, want %d", gotContentLength, len(payload))
	}
	if string(gotBody) != payload {
		t.Fatalf("body = %q, want %q", gotBody, payload)
	}
}

func TestS3BackupStore_UploadFile(t *testing.T) {
	var received []byte
	var receivedLength int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPut, r.Method)
		receivedLength = r.ContentLength
		var err error
		received, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client, err := newS3Client(context.Background(), s3ClientParams{
		Endpoint:        server.URL,
		Region:          "auto",
		AccessKeyID:     "test-ak",
		SecretAccessKey: "test-sk",
		ForcePathStyle:  true,
	})
	require.NoError(t, err)

	content := []byte("streamed backup payload")
	filePath := t.TempDir() + "/part.gz"
	require.NoError(t, os.WriteFile(filePath, content, 0o600))

	store := &S3BackupStore{client: client, bucket: "backup-bucket"}
	size, err := store.UploadFile(context.Background(), "backup/part-1", filePath, "application/octet-stream")
	require.NoError(t, err)
	require.Equal(t, int64(len(content)), size)
	require.Equal(t, int64(len(content)), receivedLength)
	require.Equal(t, content, received)
}
