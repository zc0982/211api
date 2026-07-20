# Gitea CI/CD 迁移 - Intent

## TaskIntentDraft

- Requested outcome: 将当前 fork 的 GitHub CI/CD 迁移到 Netcup 自建 Gitea，同时保持 Gateway 洛杉矶为 211API 主生产服务器
- Goal: 建立唯一由 Gitea 承载的私有代码托管、Registry 和 CI/CD 交付链
- Success evidence:
- Gitea HTTPS/SSH、私有仓库、CI、安全扫描、Registry、main 自动部署、tag release 和备份恢复均有验证证据
- Stop condition: 全部验收证据齐备则完成；缺少凭据或外部权限则阻塞；未验证生产切换则 needs-verification；发现超出 CI/CD 的业务迁移则 scope-exceeded
- Non-goals:
- 不迁移业务 PostgreSQL/Redis/配置；不公开仓库；不保留 DockerHub/Telegram/多架构发布；不删除旧 GitHub 仓库
- Scope: Netcup Gitea 平台、隔离 runner、仓库迁移、Gitea Actions、Gitea Registry、Gateway 生产部署切换与 GitHub Actions 退役
- Change kinds:
- architecture-migration
- Risk hints:
- 双交付 owner、runner 越权、生产数据库前向迁移、DNS/TLS、凭据泄露与备份不可恢复

## BaselineReadSetHint

- README_CN.md; DEV_GUIDE.md; deploy/README.md; .github/workflows/*.yml; Gitea 1.26 官方 Actions 文档; 2026-07-18 Netcup/Gateway 只读体检

## BaselineUsageDraft

- Required baseline refs:
- README_CN.md; DEV_GUIDE.md; deploy/README.md; .github/workflows/*.yml; Gitea 1.26 官方 Actions 文档; 2026-07-18 Netcup/Gateway 只读体检
- Acknowledged before plan:
- none
- Cited in plan:
- none
- Missing refs:
- README_CN.md; DEV_GUIDE.md; deploy/README.md; .github/workflows/*.yml; Gitea 1.26 官方 Actions 文档; 2026-07-18 Netcup/Gateway 只读体检
- Advisory decision: needs-baseline-readback

## ImpactStatementDraft

- Compatibility boundary: 应用内在线更新继续读取 Wei-Shaw/sub2api GitHub Releases；不形成 fork CI/CD 双 owner
- Affected layers:
- repository hosting; CI; release; registry; deployment; infrastructure; operations
- Owners:
- Gitea 是 fork 交付唯一 owner；Gateway 是 211API 生产运行 owner；GitHub 是公开上游更新来源
- Invariants:
- Netcup 不承载 211API 业务服务或业务数据；Gateway 洛杉矶继续承载主生产
- Non-goals:
- 不迁移业务 PostgreSQL/Redis/配置；不公开仓库；不保留 DockerHub/Telegram/多架构发布；不删除旧 GitHub 仓库

These records are Method Pack drafts / hints, not authoritative runtime decisions.

## BaselineUsageDraft

- Required baseline refs:
- README_CN.md
- DEV_GUIDE.md
- deploy/README.md
- .github/workflows/*.yml
- Gitea 1.26 official Actions documentation
- 2026-07-18 Netcup/Gateway read-only inspection
- Delivered context refs:
- none
- Acknowledged before plan:
- README_CN.md
- DEV_GUIDE.md
- deploy/README.md
- .github/workflows/*.yml
- Gitea 1.26 official Actions documentation
- 2026-07-18 Netcup/Gateway read-only inspection
- Cited in plan:
- docs/aegis/baseline/2026-07-18-initial-baseline.md
- docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md
- Missing refs:
- none
- Advisory decision: continue
