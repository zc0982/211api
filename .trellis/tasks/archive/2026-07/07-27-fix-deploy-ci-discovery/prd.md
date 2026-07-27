# 修复 Deploy 等待 CI 检查启动竞态

## Goal

PR #28 合并后 Deploy 在 ci-ok 创建前立即失败；升级等待 Action 并配置发现窗口。

## Requirements

- Deploy 的 `push main` 门禁必须等待同一提交的 `ci-ok` 检查，即使该检查在 Deploy workflow 启动时尚未创建。
- 保留现有 `ci-ok` 聚合语义和手动部署行为，不绕过或削弱 CI 门禁。
- 检查发现窗口必须覆盖 `race-service` 的 30 分钟超时，并留出 GitHub Actions 调度缓冲。
- 变更仅限部署 workflow 的等待步骤及必要注释。

## Acceptance Criteria

- [ ] 等待 Action 使用支持检查发现重试的稳定版本。
- [ ] `ci-ok` 尚未创建时不会在数秒内以 `The requested check was never run against this ref` 失败。
- [ ] 检查发现超时不少于 35 分钟，且 `ci-ok` 失败或取消时部署仍被阻止。
- [ ] workflow YAML 可解析，配置断言通过，PR CI 全部通过。

## Notes

- 失败运行：https://github.com/zc0982/211api/actions/runs/30240241720
- 根因：`lewagon/wait-on-check-action@v1.4.0` 在 `ci-ok` 尚未注册时立即退出；新版支持 `checks-discovery-timeout`。
