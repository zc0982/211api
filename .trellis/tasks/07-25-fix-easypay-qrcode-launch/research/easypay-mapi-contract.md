# EasyPay `mapi.php` 响应契约

## 本地证据

- `backend/internal/payment/provider/easypay.go` 的 API 模式调用 `mapi.php`，当前仅解析
  `payurl`、`payurl2` 与 `qrcode`。
- `frontend/src/components/payment/paymentFlow.ts` 在 `pay_url` 与 `qr_code` 均为空时
  返回 `unhandled`；微信/支付宝场景随后显示不可用提示。
- 弹窗模式绕过 `mapi.php`，直接生成 `submit.php` 地址，因此不受缺失字段映射影响。

## 上游协议证据

EasyPay V1 接口文档：

- https://www.jiangcen.cn/doc/v1_legacy_api.html
- `mapi.php` 成功响应可返回 `payurl`、`qrcode` 或 `urlscheme`。
- 文档明确说明三个参数只会返回其中一个。
- `urlscheme` 是用于 JS 跳转、拉起支付的小程序跳转 URL，因此应归一化到现有
  `PayURL`，而不是 `QRCode`。

## 兼容策略

1. 保留当前非空 `payurl`。
2. `payurl` 为空且 `urlscheme` 非空时，以 `urlscheme` 作为 `PayURL` 回退。
3. `qrcode` 继续独立映射为 `QRCode`。
4. 用 `httptest` 验证三类成功响应，不依赖真实支付网关。
