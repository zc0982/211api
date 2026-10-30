# v0.2.19 同步与升级核验

## 同步基线

- 上游正式发布：[`v0.2.19`](https://github.com/Wei-Shaw/sub2api/releases/tag/v0.2.19)，commit `dece26153621959ccd7635814f4b2d08304e681a`。
- Fork 基线：`a0c01963817a360d75a123f3c6d918a3ef08fb2e`，已同步 `v0.2.18` 并保留 PR #81、#82 的 credits 调度修复。
- 只同步正式 tag，不引入发布后的 `upstream/main` 提交。tag 内 VERSION 仍为 `0.2.18`，本次显式校正为 `0.2.19`。

## 升级行为

- 新增按操作、分组和资源范围授权的管理员 API Key，支持有效期、IP 白名单、轮换、撤销及审计。旧版管理员 API Key 只允许轮换已有记录，新建使用权限管理密钥。
- OpenAI / Composite 分组新增 `image_count_billing`，默认关闭；只在专用图片端点按实际出图数结算，保留渠道定价和分组定价的既有优先级。
- 新增 GPT-6.1 Terra；同步 Gemini 默认模型列表、显式缓存绑定重试、Grok 模型目录诊断及响应模型审计。
- 同步图片上传超限拒绝、Gemini fileData 图片计费、DeepSeek 缓存用量和定价、分页溢出等修复。

部署时会执行新增迁移：

| 迁移 | 影响 |
| --- | --- |
| `247_scoped_admin_api_keys.sql` | 创建权限管理密钥表，只保存不可逆摘要，保留撤销、移除和使用记录。 |
| `248_group_image_count_billing.sql` | 为 groups 增加默认 false 的按张计费开关，不自动启用既有分组。 |

Gemini 默认列表移除已停用的 2.x 和 3-pro-preview；仍需使用这些模型的账号应显式配置白名单或模型映射。这里只同步代码和迁移文件，没有执行生产迁移。

## 本地行为保留与合并适配

- credits 调度、429 响应头优先于缓存及按窗口判断的本地实现保留；相关调度、额度和阻塞实现与 fork 基线没有新增差异。
- WS 下游 Ping/Pong 保活和繁忙时延后 Ping、S3 临时文件流式上传及明确 Content-Length 与 fork 基线一致。
- 保留 `/v1/messages` 等待响应头时的首输出期限、Codex 顶层 input 归一化、长上下文定价默认值、部署镜像覆盖及本地 CI 门禁。
- 唯一文本冲突位于 Gemini 账号测试的 imports：新增 geminicli 导入，继续使用本地 `newTestContext()`，不恢复 Gin 全局模式写入。
- CI 关键前端清单补入管理员密钥设置、Grok 目录诊断和编辑、渠道配置、订阅卡片及 i18n 编译和运行时回归。

## 安全门禁适配

首次安全检查发现现有 Vue I18n `9.14.5` 命中 [GHSA-83rm-6c8r-g728](https://github.com/advisories/GHSA-83rm-6c8r-g728)：HTML 翻译参数可通过 iframe srcdoc 绕过转义。官方未提供 v9/v10 修复，修复版本为 `11.4.14`。

- 将 `vue-i18n` 和直接使用的 `@intlify/message-compiler` 一起升级到 `11.4.14`，锁文件仅更新对应依赖树。
- 应用已有 `legacy: false` 和 JIT 配置，继续使用 Composition API。新增回归验证消息延迟加载、语言切换、fallback、命名插值、复数以及 srcdoc 属性被禁用。
- v11 runtime 默认 JIT 后，订阅卡片测试会得到真实译文；将旧的“返回 key”断言改为现有 fixture 译文，保留单位和布局断言。
- 新依赖要求 Node >=22，将 CI、security、release 的 Node 从 20 对齐到 Docker 构建已使用的 24；pnpm 版本约定仍为 9。
- 未新增安全豁免。最终 pnpm 生产依赖扫描剩余 2 项 high，均为已有且仍有效的 SheetJS 只写导出豁免。

## 本地验证

本地 Go `1.27.3`、golangci-lint `2.14.0`；Node `26.12.1`、pnpm `10.28.0`。CI / Docker 使用 Node 24、pnpm 9。

已通过：版本完整性 11 项测试和显式 `--expected 0.2.19` 校验、integration 包登记、4 个包的 PG18/Redis 集成测试、隔离 PG18 上 33 项 scoped 管理员测试、golangci-lint（0 issues）、govulncheck（无受影响的调用）、pnpm 生产依赖安全例外校验、部署脚本和 10 项 release matrix 测试。

部署脚本测试使用 fixtures；Compose 通过本机独立 docker-compose 命令适配，installer 测试通过 GNU head 运行。隔离 scoped 测试容器已删除，没有清理既有容器或数据。

后端 58 个 unit 包通过，service race 全量通过（280.032s）；前端 lint、typecheck、376 个文件的 3,023 项测试及生产构建通过。包含前端资源的后端 release 构建通过，产物 `-version` 回读为 `0.2.19`；`go mod verify` 全部通过。

代码同步和本地验证完成；PR CI、合并与生产部署是独立步骤，本记录不代表生产已升级。

## 合并后的安全扫描补修（2026-10-29）

PR #84 已合并为 `7cb4d4a2876fc0b3a9938a8bc077addcbadd6f6c`，合并树与 PR head 一致。原 PR 的 CI / Security Scan 通过；合并后的 [Security Scan](https://github.com/zc0982/211api/actions/runs/40987905082) 在 `frontend-security / Check audit exceptions` 失败，报告 [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)。该公告于 2026-10-29 收录至 GitHub Advisory Database。

依赖路径为 `@lobehub/icons → @lobehub/ui → query-string → decode-uri-component@0.4.1`，受影响版本为 `<=0.5.0`。通过 pnpm override 将受影响的间接依赖固定到修复版 `0.5.1`，同步锁文件；不新增安全豁免，不改变应用逻辑。

补修使用 CI 同代工具链 Node `24.22.2` / pnpm `9.15.9` 验证：冻结锁文件安装、lint、typecheck、102 个文件的 1,363 项关键前端测试、生产构建及安全例外校验通过。query-string 的中文、重复参数、畸形编码和序列化往返兼容性检查通过，公告中的 224 KB 输入正常完成解码；扫描中已无 decode-uri-component 告警，剩余 2 项 high 仍为已有有效的 SheetJS 例外。
