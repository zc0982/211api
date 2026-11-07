# 上游同步约定

## 基线与版本

- 同步最新正式 release tag；记录 tag 对应的 commit，不将 annotated tag 对象 SHA 当作源码 SHA。
- 先 fetch origin 与 upstream，在最新 origin/main 的独立 worktree 中普通 merge。保留原工作区和既有本地修复。
- `backend/cmd/server/VERSION` 必须与目标 release 一致；上游 tag 内的 VERSION 可能落后一版。执行 `make -C backend test-version-integrity`。
- 每次同步在 `docs/upstream-v<version>-sync.md` 记录基线、冲突处理、行为变化、迁移及实际验证结果。

## 本地兼容要求

- 保留 credits 调度与逐窗口额度豁免、首输出期限、WebSocket 下游保活、S3 流式上传及部署配置；只有等价行为已有证据时才移除本地差异。
- 上游新增限制必须覆盖本地保留的异步路径。SSE 透传的同步扫描与保活扫描均执行事件行数/字节上限；异步队列执行字节预算，取消不得阻塞生产者。
- scanner buffer 由实际扫描分支归还一次，不能在外层与扫描 goroutine 中重复归还。
- 队列预算不得拒绝合法的单个大图帧；超限的无分隔事件不得输出成功 terminal。

## 验证与交付

- 执行后端 unit、integration、service race、lint、安全扫描，前端 lint、typecheck、相关测试、安全扫描及生产构建；新增关键功能测试登记到根 Makefile 的 CI 清单。
- 验证 Compose 环境变量、部署脚本、release helpers 和带前端资源的后端构建；记录环境限制，不能把未运行或跳过当作通过。
- PR 前重新 fetch origin/main 并确认祖先关系、净 diff、无冲突标记和无本地配置入库。
- 代码同步、本地检查、PR CI、合并、构建、部署和生产生效是独立状态。创建 PR 不自动合并；生产迁移、功能开关启用按对应授权执行。
