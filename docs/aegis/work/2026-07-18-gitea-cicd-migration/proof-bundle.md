# Proof Bundle - 2026-07-18-gitea-cicd-migration

## Method Pack Boundary

This proof bundle is an advisory Aegis Method Pack record. It does not determine evidence sufficiency, produce authoritative `GateDecision`, or grant `completion authority`.

## Task Intent

- Requested outcome: 将当前 fork 的 GitHub CI/CD 迁移到 Netcup 自建 Gitea，同时保持 Gateway 洛杉矶为 211API 主生产服务器
- Scope: Netcup Gitea 平台、隔离 runner、仓库迁移、Gitea Actions、Gitea Registry、Gateway 生产部署切换与 GitHub Actions 退役

## Impact

- Compatibility boundary: 应用内在线更新继续读取 Wei-Shaw/sub2api GitHub Releases；不形成 fork CI/CD 双 owner
- Non-goals:
- 不迁移业务 PostgreSQL/Redis/配置；不公开仓库；不保留 DockerHub/Telegram/多架构发布；不删除旧 GitHub 仓库

## Evidence Bundle Refs

- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-design-self-review.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-gateway-host-inspection.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-gitea-official-docs.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-implementation-plan-review.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-independent-design-review.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-netcup-host-inspection.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-repo-ci-audit.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-task1-preflight.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-task2-3-repository-ci.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-task8-repository-gate.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-user-design-decisions.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-written-design-approval.json

## Drift Check

- Scope status: Task 8 仅验证仓库、一次性本地容器和本地派生镜像；未改 Netcup、Gateway、Gitea、DNS、Registry、GitHub 或业务运行时
- Compatibility status: Gateway 仍是唯一生产 owner，`Wei-Shaw/sub2api` updater/download 边界保持非空
- Retirement status: feature branch 已退休 GitHub workflow/GoReleaser 代码 owner 与旧 secret 名；外部 GitHub owner 仍受 Task 12/13 门禁约束
- Runtime boundary: Task 8 不构成 Netcup/Gateway 生产验证；真实 NTP/DNS/TLS/身份/Registry/SSH/备份恢复证据仍在 Tasks 9-12/15
- Advisory decision: continue
