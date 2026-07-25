# 修复 EasyPay 二维码支付无法拉起

## Goal

让 EasyPay 二维码模式正确消费 `mapi.php` 的标准成功响应，避免上游仅返回
`urlscheme` 时订单被前端误判为“微信/支付宝支付暂不可用”，同时保持现有弹窗、
二维码和普通跳转行为不变。

## Background

- EasyPay 弹窗模式直接生成 `submit.php` 地址，当前可以正常支付。
- EasyPay 二维码模式调用 `mapi.php`。当前适配器只读取 `payurl` 和 `qrcode`，忽略
  标准响应中的 `urlscheme`。
- 前端只消费后端统一后的 `pay_url` / `qr_code`。二者都为空时，
  `decidePaymentLaunch` 返回 `unhandled`，继而展示用户报告的不可用提示。
- EasyPay V1 文档声明成功响应的 `payurl`、`qrcode`、`urlscheme` 三者只返回一个；
  `urlscheme` 应按可跳转支付地址处理。

## Requirements

1. EasyPay `mapi.php` 成功响应返回非空 `urlscheme` 且 `payurl` 为空时，后端必须将
   `urlscheme` 归一化为现有 `CreatePaymentResponse.PayURL`，使现有前端跳转分支可用。
2. 非空 `payurl` 继续作为首选跳转地址；兼容逻辑不得覆盖它。
3. 非空 `qrcode` 继续原样映射为 `CreatePaymentResponse.QRCode`，不得把
   `urlscheme` 错误伪装成二维码内容。
4. 现有 `popup` 模式仍只生成 `submit.php` 地址，不改变签名、通知地址、订单金额、
   支付方式或移动端参数。
5. 使用本地 `httptest` 覆盖 EasyPay 创建订单响应的协议变体，不调用真实支付平台，
   不在测试或日志中加入商户密钥。

## Acceptance Criteria

- [x] AC1：当 `mapi.php` 返回 `code=1`、有效 `trade_no` 和仅有的 `urlscheme` 时，
  `CreatePayment` 成功返回相同 `TradeNo`，且 `PayURL` 等于该 `urlscheme`。
- [x] AC2：当响应同时含有 `payurl` 与 `urlscheme` 时，返回的 `PayURL` 保持为
  `payurl`，证明兼容回退不会覆盖既有协议字段。
- [x] AC3：当响应含有 `qrcode` 时，返回的 `QRCode` 保持不变，既有二维码流程不回归。
- [x] AC4：聚焦的 Go 回归测试通过，变更文件通过 `gofmt`；后端相关构建/静态检查
  不引入新错误。
- [x] AC5：代码审查确认没有修改前端、数据库、支付配置、签名算法或回调履约逻辑。

## Out of Scope

- 调整支付供应商配置、商户权限、密钥或部署环境。
- 重设计前端支付页面、提示文案或二维码组件。
- 改变官方微信支付、官方支付宝、Stripe、Airwallex 等其他 Provider。
- 将前端跳转成功作为支付完成依据；订单履约仍以现有回调/查单结果为准。

## Technical Notes

- 数据流：EasyPay `mapi.php` JSON → EasyPay Provider 归一化 →
  `CreateOrderResponse.pay_url` → 前端现有 `redirect_waiting` 分支。
- 本任务为单点协议兼容修复，采用 PRD-only，不需要 `design.md` / `implement.md`。
- 阻塞性开放问题：无。

## Verification Evidence

- `go test -count=1 ./internal/payment/provider`：通过。
- `make test`：全量 `go test ./...` 与 `golangci-lint run ./...` 通过，0 issues。
- `make build`：通过。
- `gofmt -d` 与 `git diff --check`：无输出/通过。
- 独立检查补充移动端用例，确认 `payurl2` 仍优先于 `payurl`。
