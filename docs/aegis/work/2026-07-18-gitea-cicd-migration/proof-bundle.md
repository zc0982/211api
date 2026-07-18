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
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-user-design-decisions.json
- docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-written-design-approval.json

## Drift Check

- Scope status: 仍限定为 Gitea 平台与 CI/CD 迁移，未迁移 211API 业务运行时
- Compatibility status: Gateway 生产 owner 和 GitHub 上游更新边界保持不变
- Retirement status: GitHub Actions/GHCR/DockerHub/Telegram 退役路径已显式记录，尚未执行
- Advisory decision: continue
