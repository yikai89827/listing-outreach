# Lemon Squeezy · 支付 & 发 Key 检查清单

扩展侧：买家粘贴 `LO-…` key → 本地 HMAC 校验（`extension/lib/license.js`）。  
卖家侧：收款后发 key（先手工，再自动化）。

## 0. 扩展里填 Checkout 链接

1. 在 Lemon Squeezy 创建好商品后，复制 **Checkout / Buy** 链接  
2. 粘贴到 `extension/lib/commerce.js` 的 `CHECKOUT_URL`  
3. 按需改 `PRICING.priceLabel`（仅展示）  
4. 重新加载扩展 → Pro license 卡点 **Buy Pro**

## 1. Lemon Squeezy 商品

- [ ] 注册 [Lemon Squeezy](https://www.lemonsqueezy.com/) 并完成店铺 / 收款设置  
- [ ] 新建 Product：`Listing Outreach Pro`  
- [ ] 定价：建议一次性（如 `$29`）或年费（如 `$19/yr`）  
- [ ] Variant 名称清晰（Lifetime vs Annual）  
- [ ] 开启结账成功页（Thank you）可展示自定义说明：「key 将发到邮箱」  
- [ ] 复制 Buy 链接 → 写入 `CHECKOUT_URL`

## 2. 发 Key（阶段 A · 手工，前几十单）

付款通知到了之后：

```bash
# 终身
npm run gen-license

# 年费（示例）
npm run gen-license -- --exp 2027-12-31

# 按买家备注（可选）
npm run gen-license -- --seed buyer@email.com --exp 2027-12-31
```

- [ ] 把输出的 `LO-…` 发到买家邮箱（主题含订单号）  
- [ ] 邮件正文写明：打开扩展 → Pro license → 粘贴 → Activate  
- [ ] 本地留一份订单表：`email / order id / key / date / exp`

查 key 内容（仅你本机）：

```bash
npm run gen-license -- --decode LO-…
```

## 3. 发 Key（阶段 B · 半自动，推荐）

任选其一，**仍不必自建后端**：

### 方案 B1 · Zapier / Make

- [ ] Trigger：Lemon Squeezy `Order created`（paid）  
- [ ] Action：邮件给买家（先可模板里写「我们会在 24h 内发 key」；或接 Google Sheet 人工填）  
- [ ] 进阶：用 Zapier Code / 自建小脚本调 `gen-license` 逻辑发信（需把 secret 放在自动化环境）

### 方案 B2 · LS 自带 License Keys

- [ ] 商品开启 License keys  
- [ ] Thank-you / 邮件自动带 LS key  
- [ ] **注意**：LS key 格式与当前 `LO-…` 不同；若走此路，需改 `license.js` 调 [LS License API](https://docs.lemonsqueezy.com/help/licensing/license-api) 校验（要网络）

### 方案 B3 · Webhook → 小函数发 `LO-…`（量起来再做）

- [ ] LS Webhook：`order_created`  
- [ ] Cloudflare Worker / 小 VPS：验签 → `gen-license` 同算法 → Resend/SES 发信  
- [ ] 扩展继续纯本地验 `LO-…`（与现在一致）

## 4. 扩展内用户路径（已实现）

1. Free：20 generates/day · 1 次导出试用  
2. 打开 Pro license 卡 → **Buy Pro**（LS Checkout）  
3. 付款后邮箱收到 `LO-…`  
4. 粘贴 → **Activate** → 卡片隐藏，右上角 **Pro**  
5. **Pro ▾ → Clear license** → 卡片回来

## 5. 运营注意

| 场景 | 做法 |
|------|------|
| 退款 | 邮件告知 key 作废；本地 key 无法远程吊销（防君子）。可换 secret 作废全部旧 key，或维护黑名单（需发版） |
| 丢 key | 用订单邮箱重发；`--seed email` 可生成稳定 nonce 便于核对 |
| 年费到期 | key 内嵌到期日；到期后自动变 Free |
| 费率 | LS 约 **5% + $0.50**/单，无月租 |

## 6. 上线顺序建议

1. 填好 `CHECKOUT_URL`，扩展发版 / 上架  
2. 手工发 key 跑通 5～10 单  
3. 再上 Zapier 或 Webhook 自动发信  
4. 有作弊再考虑 LS License API / 设备绑定
