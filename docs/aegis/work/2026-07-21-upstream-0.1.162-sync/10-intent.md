# 同步上游 0.1.162 - Intent

> 历史记录（2026-07-26 补注）：本次同步真实发生过，但其中的 Gitea fork 所有权、
> Gitea CI/CD 边界与「不启用 GitHub Actions」等约束已随自建 Gitea 退役而失效。
> 当前交付所有权为 GitHub Actions + GHCR，业务版本已到 0.1.164。仅作历史记录，
> 不再作为对齐依据。

## TaskIntentDraft

- Requested outcome: 将 upstream/main 的 0.1.162 业务版本同步到受保护 Gitea fork，并保留现有 Gitea CI/CD 与 AMD64-only 发布边界
- Goal: 将 upstream/main 的 0.1.162 业务版本同步到受保护 Gitea fork，并保留现有 Gitea CI/CD 与 AMD64-only 发布边界
- Success evidence:
- 保留 merge history；VERSION=0.1.162；所有冲突和交叉部署配置经语义审查；旧 GitHub/GoReleaser owner 不复活；本地及受保护 CI/security/deploy 通过；生产健康
- Stop condition: 验证完成并部署健康则 done；安全默认、迁移或保护边界无法确认则 blocked/needs-verification；需要改变 Gitea-only 或生产所有权则 scope-exceeded
- Non-goals:
- 不执行 Task 17，不创建 release tag，不启用 GitHub Actions，不改变 Registry/release architecture
- Scope: 从 origin/main 创建隔离同步分支，合并 upstream/main，解决冲突，验证并通过受保护 PR 集成
- Change kinds:
- upstream-integration
- Risk hints:
- 两边分叉 124/213 commits；部署配置交叉修改；step-up 2FA 默认变化；数据库迁移；不得恢复 GitHub Actions/GoReleaser

## BaselineReadSetHint

- docs/aegis/baseline/2026-07-18-initial-baseline.md

## BaselineUsageDraft

- Required baseline refs:
- docs/aegis/baseline/2026-07-18-initial-baseline.md
- Acknowledged before plan:
- docs/aegis/baseline/2026-07-18-initial-baseline.md
- Cited in plan:
- docs/aegis/baseline/2026-07-18-initial-baseline.md
- Missing refs:
- none
- Advisory decision: baseline-readback-complete

## ImpactStatementDraft

- Compatibility boundary: 保留 .gitea 与 deploy/gitea 定制、axios 1.18.1 安全修复、Gateway runtime variables；不得恢复 .github workflows 或 .goreleaser files
- Affected layers:
- backend, frontend, database migrations, deploy config, Gitea CI/CD compatibility
- Owners:
- sync/upstream-0.1.162 integration branch and protected PR
- Invariants:
- Gitea remains sole CI/CD/release/deploy owner; production remains Gateway; no DockerHub/GHCR/Telegram/multiarch outputs
- Non-goals:
- 不执行 Task 17，不创建 release tag，不启用 GitHub Actions，不改变 Registry/release architecture

These records are Method Pack drafts / hints, not authoritative runtime decisions.
