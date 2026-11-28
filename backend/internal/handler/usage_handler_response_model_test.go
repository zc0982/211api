package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

type usageDisclosureRepo struct {
	service.ChannelRepository
	enabled map[int64]bool
	err     error
	calls   [][]int64
}

func (r *usageDisclosureRepo) ListResponseModelExposureEnabled(_ context.Context, ids []int64) (map[int64]bool, error) {
	r.calls = append(r.calls, append([]int64(nil), ids...))
	return r.enabled, r.err
}

type usageDisclosureLogs struct {
	*userUsageRepoCapture
}

func (r usageDisclosureLogs) GetByID(_ context.Context, id int64) (*service.UsageLog, error) {
	return &r.listRows[id-1], nil
}

func TestUserUsageResponseModelRequiresCurrentChannelPermission(t *testing.T) {
	allow, deny := int64(11), int64(22)
	actual, same, sent, chain := "observed-model", " requested ", "internal-sent", "requested→internal-mapping"
	rows := []service.UsageLog{
		{ChannelID: &allow, UpstreamResponseModel: &actual},
		{ChannelID: &deny, UpstreamResponseModel: &actual},
		{ChannelID: &allow},
		{ChannelID: &allow, UpstreamResponseModel: &same},
		{UpstreamResponseModel: &actual},
	}
	for i := range rows {
		rows[i].ID = int64(i + 1)
		rows[i].UserID = 42
		rows[i].Model = "internal-billing"
		rows[i].RequestedModel = "requested"
		rows[i].UpstreamModel = &sent
		rows[i].ModelMappingChain = &chain
	}
	usageRepo := &userUsageRepoCapture{listRows: rows}
	channelRepo := &usageDisclosureRepo{enabled: map[int64]bool{allow: true}}
	channel := service.NewChannelService(channelRepo, nil, nil, nil, nil)
	h := NewUsageHandler(service.NewUsageService(usageDisclosureLogs{usageRepo}, nil, nil, nil), nil, nil, nil, channel)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(middleware2.ContextKeyUser), middleware2.AuthSubject{UserID: 42})
	})
	router.GET("/api/v1/usage", h.List)
	router.GET("/api/v1/usage/:id", h.GetByID)
	get := func(url string, status int) gjson.Result {
		t.Helper()
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
		require.Equal(t, status, rec.Code, rec.Body.String())
		return gjson.GetBytes(rec.Body.Bytes(), "data")
	}
	check := func(item gjson.Result, want string) {
		t.Helper()
		require.Equal(t, "requested", item.Get("model").String())
		if want == "" {
			require.False(t, item.Get("response_model").Exists(), item.Raw)
		} else {
			require.Equal(t, want, item.Get("response_model").String())
		}
		for _, key := range []string{"upstream_model", "upstream_response_model", "model_mapping_chain", "channel_id"} {
			require.False(t, item.Get(key).Exists(), item.Raw)
		}
		require.NotContains(t, item.Raw, "internal-")
	}

	items := get("/api/v1/usage", http.StatusOK).Get("items").Array()
	require.Len(t, items, len(rows))
	require.Equal(t, int64(42), usageRepo.listFilters.UserID)
	require.Equal(t, [][]int64{{allow, deny}}, channelRepo.calls)
	for i, want := range []string{actual, "", "", "", ""} {
		check(items[i], want)
		check(get(fmt.Sprintf("/api/v1/usage/%d", i+1), http.StatusOK), want)
	}

	delete(channelRepo.enabled, allow)
	check(get("/api/v1/usage", http.StatusOK).Get("items.0"), "")
	check(get("/api/v1/usage/1", http.StatusOK), "")
	channelRepo.enabled[allow] = true
	channelRepo.err = errors.New("synthetic permission read failure")
	check(get("/api/v1/usage", http.StatusOK).Get("items.0"), "")
	check(get("/api/v1/usage/1", http.StatusOK), "")

	usageRepo.listRows[0].UserID = 99
	calls := len(channelRepo.calls)
	get("/api/v1/usage/1", http.StatusForbidden)
	require.Len(t, channelRepo.calls, calls)
}
