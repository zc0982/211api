.PHONY: build build-backend build-frontend test test-backend test-frontend test-frontend-critical

FRONTEND_CRITICAL_VITEST := \
	src/i18n/__tests__/localeKeyCompleteness.spec.ts \
	src/api/__tests__/client.spec.ts \
	src/api/__tests__/tokenRefresh.spec.ts \
	src/api/__tests__/keys.bulkUpdate.spec.ts \
	src/components/account/__tests__/OpenAIReferralCell.spec.ts \
	src/components/account/__tests__/OpenAIReferralCell.transport.spec.ts \
	src/components/account/__tests__/OpenAIQuotaResetCell.spark_shadow.spec.ts \
	src/components/keys/__tests__/BulkEditKeysModal.spec.ts \
	src/components/admin/user/__tests__/UserPlatformQuotaModal.spec.ts \
	src/views/user/__tests__/KeysView.spec.ts \
	src/api/__tests__/channelMonitorV2.spec.ts \
	src/views/auth/__tests__/LinuxDoCallbackView.spec.ts \
	src/views/auth/__tests__/WechatCallbackView.spec.ts \
	src/views/user/__tests__/PaymentView.spec.ts \
	src/views/user/__tests__/PaymentResultView.spec.ts \
	src/views/user/__tests__/ChannelStatusView.mode.spec.ts \
	src/components/user/profile/__tests__/ProfileInfoCard.spec.ts \
	src/views/admin/__tests__/SettingsView.spec.ts \
	src/components/account/__tests__/AccountPriorityCell.spec.ts \
	src/components/account/__tests__/BulkEditAccountModal.spec.ts \
	src/components/account/__tests__/CreateAccountModal.spec.ts \
	src/components/payment/__tests__/AmountInput.spec.ts \
	src/components/user/__tests__/UserPlatformQuotaCell.spec.ts \
	src/components/user/dashboard/__tests__/UserDashboardStats.spec.ts \
	src/constants/__tests__/platforms.spec.ts \
	src/i18n/__tests__/opsLocaleKeys.spec.ts \
	src/utils/__tests__/rechargeBonus.spec.ts \
	src/views/admin/__tests__/AccountsView.lite.spec.ts \
	src/components/account/__tests__/UpstreamRequestIdHeaderField.spec.ts \
	src/components/admin/group/__tests__/CodexManifestAccountsField.spec.ts \
	src/features/channel-monitor-v2/__tests__/designSystem.structure.spec.ts \
	src/features/channel-monitor-v2/__tests__/monitorFormat.spec.ts \
	src/features/channel-monitor-v2/__tests__/monitorZoom.spec.ts \
	src/components/account/__tests__/AccountStatusIndicator.spec.ts \
	src/components/account/__tests__/ClaudeResetCreditsCell.spec.ts \
	src/components/account/__tests__/EditAccountModal.spec.ts \
	src/components/account/__tests__/ModelWhitelistSelector.spec.ts \
	src/components/keys/__tests__/UseKeyModal.spec.ts \
	src/composables/__tests__/useModelWhitelist.spec.ts \
	src/views/admin/__tests__/DashboardView.spec.ts \
	src/api/__tests__/codex.spec.ts \
	src/components/account/__tests__/credentialsBuilder.spec.ts \
	src/components/common/__tests__/PlatformTypeBadge.openaiPlans.spec.ts \
	src/components/account/__tests__/credentialsBuilder.platformCatalog.spec.ts \
	src/components/account/__tests__/OpenCodeGoProtocolRulesEditor.spec.ts \
	src/components/user/profile/__tests__/ProfileIdentityBindingsSection.spec.ts \
	src/components/admin/channel/__tests__/PricingEntryCard.modelDefaultPrice.spec.ts \
	src/api/__tests__/settings.authSourceDefaults.spec.ts \
	src/components/account/__tests__/AccountUsageCell.spec.ts \
	src/components/admin/__tests__/ErrorPassthroughRulesModal.toggle.spec.ts \
	src/components/admin/account/__tests__/AccountTableFilters.spec.ts \
	src/components/admin/account/__tests__/ScheduledTestsPanel.results.spec.ts \
	src/components/admin/group/__tests__/GroupRPMOverridesModal.edit.spec.ts \
	src/components/admin/group/__tests__/GroupRateMultipliersModal.requests.spec.ts \
	src/components/admin/monitor/__tests__/MonitorTemplateManagerDialog.requests.spec.ts \
	src/components/admin/usage/__tests__/UsageCleanupDialog.spec.ts \
	src/components/admin/usage/__tests__/UsageTable.spec.ts \
	src/components/admin/user/__tests__/BulkEditUserModal.spec.ts \
	src/components/auth/__tests__/PendingOAuthCreateAccountForm.spec.ts \
	src/components/common/__tests__/AnnouncementBell.spec.ts \
	src/components/common/__tests__/BaseDialog.escape.spec.ts \
	src/components/common/__tests__/disabledSelectors.spec.ts \
	src/components/user/profile/__tests__/ProfileBalanceNotifyCard.spec.ts \
	src/components/user/profile/__tests__/ProfileEditForm.draft.spec.ts \
	src/composables/__tests__/useBatchImageAccess.retry.spec.ts \
	src/composables/__tests__/useStepUp.spec.ts \
	src/stores/__tests__/adminCompliance.reset.spec.ts \
	src/utils/__tests__/formatBytes.spec.ts \
	src/utils/__tests__/latencyHealth.spec.ts \
	src/utils/__tests__/pricing.formatScaled.spec.ts \
	src/views/admin/__tests__/BackupView.spec.ts \
	src/views/admin/__tests__/ChannelsView.modelSync.spec.ts \
	src/views/admin/__tests__/PluginsView.spec.ts \
	src/views/admin/__tests__/channelPlatformOptions.spec.ts \
	src/views/admin/ops/components/__tests__/OpsAlertEventsCard.pagination.spec.ts \
	src/views/admin/ops/components/__tests__/OpsAlertRulesCard.duration.spec.ts \
	src/views/admin/ops/components/__tests__/OpsDashboardHeader.spec.ts \
	src/views/admin/ops/components/__tests__/OpsSettingsDialog.loading.spec.ts \
	src/views/user/__tests__/AirwallexPaymentView.lifecycle.spec.ts \
	src/views/user/__tests__/CustomPageView.race.spec.ts \
	src/views/user/__tests__/StripePaymentView.spec.ts \
	src/views/user/__tests__/UsageView.spec.ts

# 一键编译前后端
build: build-backend build-frontend

# 编译后端（复用 backend/Makefile）
build-backend:
	@$(MAKE) -C backend build

# 编译前端（需要已安装依赖）
build-frontend:
	@pnpm --dir frontend run build

# 运行测试（后端 + 前端）
test: test-backend test-frontend

test-backend:
	@$(MAKE) -C backend test

test-frontend:
	@pnpm --dir frontend run lint:check
	@pnpm --dir frontend run typecheck
	@$(MAKE) test-frontend-critical

test-frontend-critical:
	@pnpm --dir frontend exec vitest run $(FRONTEND_CRITICAL_VITEST)
