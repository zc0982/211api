//go:build integration

package repository

import (
	"context"
	"database/sql"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestChannelResponseModelRevocationWithoutPubSub(t *testing.T) {
	ctx := context.Background()
	group := mustCreateGroup(t, integrationEntClient, &service.Group{Name: t.Name(), RateMultiplier: 1})
	t.Cleanup(func() {
		require.NoError(t, integrationEntClient.Group.DeleteOneID(group.ID).Exec(ctx))
	})
	exposed := &service.Channel{GroupIDs: []int64{group.ID}, FeaturesConfig: map[string]any{"expose_response_model": true}}
	publisherRepo := newReasoningPricingIntegrationChannel(t, exposed)
	stringFlag := &service.Channel{
		Name: t.Name() + "-string", Status: service.StatusActive, BillingModelSource: service.BillingModelSourceRequested,
		FeaturesConfig: map[string]any{"expose_response_model": "true"},
	}
	require.NoError(t, publisherRepo.Create(ctx, stringFlag))
	t.Cleanup(func() { require.NoError(t, publisherRepo.Delete(ctx, stringFlag.ID)) })
	subscriberDB, err := sql.Open("postgres", integrationDSN)
	require.NoError(t, err)
	t.Cleanup(func() { _ = subscriberDB.Close() })
	publisher := service.NewChannelService(publisherRepo, nil, nil, nil, nil)
	subscriber := service.NewChannelService(NewChannelRepository(subscriberDB), nil, nil, nil, nil)
	ids := []int64{exposed.ID, stringFlag.ID, -1}
	for _, svc := range []*service.ChannelService{publisher, subscriber} {
		cached, err := svc.GetChannelForGroup(ctx, group.ID)
		require.NoError(t, err)
		require.Equal(t, true, cached.FeaturesConfig["expose_response_model"])
		require.Equal(t, map[int64]bool{exposed.ID: true}, svc.ResponseModelExposedChannels(ctx, ids))
	}
	_, err = publisher.Update(ctx, exposed.ID, &service.UpdateChannelInput{FeaturesConfig: map[string]any{"expose_response_model": false}})
	require.NoError(t, err)
	stale, err := subscriber.GetChannelForGroup(ctx, group.ID)
	require.NoError(t, err)
	require.Equal(t, true, stale.FeaturesConfig["expose_response_model"], "disconnection leaves ordinary channel cache stale")
	require.Empty(t, subscriber.ResponseModelExposedChannels(ctx, ids))
	require.Empty(t, publisher.ResponseModelExposedChannels(ctx, ids))

	_, err = publisher.Update(ctx, exposed.ID, &service.UpdateChannelInput{FeaturesConfig: map[string]any{"expose_response_model": true}})
	require.NoError(t, err)
	require.Equal(t, map[int64]bool{exposed.ID: true}, subscriber.ResponseModelExposedChannels(ctx, ids))
	require.NoError(t, subscriberDB.Close())
	require.Empty(t, subscriber.ResponseModelExposedChannels(ctx, ids))
}
