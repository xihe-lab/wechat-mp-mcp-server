# API 文档 — 14 个 MCP 工具接口

## 认证管理

### wechat_auth_configure

配置微信公众号 AppID 和 AppSecret，配置后自动验证并获取 Access Token。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| app_id | string | 是 | 公众号 AppID |
| app_secret | string | 是 | 公众号 AppSecret |

**返回：**
```
配置成功，Access Token 已获取（72_abc12345...）
```

**错误：**
- `[WECHAT_001]` — 凭据无效或缺失
- `[WECHAT_002]` — 微信 API 返回错误（errcode）
- `[WECHAT_006]` — 网络错误

---

### wechat_auth_get_token

获取当前 Access Token。如果 Token 未过期（剩余 > 200s）直接返回缓存值，否则自动刷新。

**参数：** 无

**返回：**
```json
{ "access_token": "72_xxx...", "expires_at": 1780467947 }
```

**错误：**
- `[WECHAT_001]` — AppID 未配置（DB 和环境变量均无）

---

### wechat_auth_refresh

强制刷新 Access Token，无论当前 Token 是否过期。

**参数：** 无

**返回：**
```
Access Token 已刷新（72_def4567890...）
```

---

## 素材管理

### wechat_media_upload

上传临时素材（图片/语音/视频）到微信服务器。返回的 `media_id` 有效期 3 天，可用作草稿封面图。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | enum | 是 | 素材类型：`image` / `voice` / `video` |
| file_path | string | 是 | 本地文件绝对路径 |

**文件限制：**

| 类型 | 允许格式 | 大小限制 |
|------|---------|---------|
| image | JPG, JPEG, PNG | ≤ 10MB |
| voice | MP3, WMA, WAV, AMR | ≤ 10MB |
| video | MP4 | ≤ 10MB |

**路径安全**：禁止包含 `..` 的路径。

**返回：**
```json
{ "media_id": "media_abc123", "type": "image", "created_at": 1780467947 }
```

---

### wechat_media_get

获取临时素材的元信息。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| media_id | string | 是 | 素材 media_id |

**返回：**
```
素材获取成功（media_id: media_abc123，content-type: image/jpeg，size: 102400 bytes）
```

---

## 永久图片素材

### wechat_material_upload_image

上传永久图片素材到微信服务器。返回的 `media_id` 无有效期限制，可用作草稿封面图（`thumb_media_id`）。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file_path | string | 是 | 本地图片绝对路径 |

**文件限制：** JPG/PNG，≤ 10MB，路径禁止 `..`。

**返回：**
```json
{ "media_id": "media_abc123", "url": "https://mmbiz.qpic.cn/..." }
```

**注意**：与临时素材 `media_upload` 不同，永久图片的 `media_id` 不会过期，适合作为草稿封面长期使用。

---

## 草稿管理

### wechat_draft_add

创建草稿，支持多图文（最多 8 篇）。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| articles | array | 是 | 图文列表，1-8 篇 |

**articles 数组元素：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 标题 |
| author | string | 否 | 作者 |
| digest | string | 否 | 摘要 |
| content | string | 是 | 正文 HTML |
| content_source_url | string | 否 | 原文链接 |
| thumb_media_id | string | 是 | 封面图 media_id |
| show_cover_pic | boolean | 否 | 是否显示封面（默认 true） |

**返回：**
```json
{ "media_id": "draft_abc123" }
```

**注意**：返回的 `media_id` 用于 `wechat_publish_submit`。

---

### wechat_draft_list

分页获取草稿列表。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| offset | number | 否 | 偏移量（默认 0） |
| count | number | 否 | 每页数量（默认 20，最大 20） |

**返回：**
```json
{
  "total_count": 50,
  "item": [
    {
      "media_id": "draft_abc123",
      "content": { "news_item": [...] },
      "update_time": 1780467947
    }
  ]
}
```

---

### wechat_draft_get

获取草稿详情。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| media_id | string | 是 | 草稿 media_id |

---

### wechat_draft_delete

删除草稿。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| media_id | string | 是 | 草稿 media_id |

**返回：**
```
草稿 draft_abc123 已删除
```

---

## 发布管理

### wechat_publish_submit

提交草稿发布。发布为异步操作，提交后需轮询 `wechat_publish_get` 查询结果。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| media_id | string | 是 | 草稿 media_id（来自 draft_add） |

**返回：**
```json
{ "publish_id": "2247483647", "article_id": "art_abc123" }
```

---

### wechat_publish_list

分页获取已发布文章列表。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| offset | number | 否 | 偏移量（默认 0） |
| count | number | 否 | 每页数量（默认 20，最大 20） |

**返回：**
```json
{
  "total_count": 200,
  "item": [
    {
      "article_id": "art_abc123",
      "title": "文章标题",
      "publish_time": 1780467947
    }
  ]
}
```

---

### wechat_publish_get

查询发布状态。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| article_id | string | 是 | 发布文章 article_id |

**返回（含中文状态提示）：**
```json
{
  "publish_id": "2247483647",
  "article_id": "art_abc123",
  "publish_status": "success",
  "status_text": "发布成功"
}
```

**发布状态：**

| 状态 | status_text | 说明 |
|------|------------|------|
| publishing | 发布中，请稍后查询 | 微信异步处理中 |
| success | 发布成功 | 发布完成 |
| failed | 发布失败（第 N 篇） | 某篇内容问题 |

---

### wechat_publish_delete

删除已发布文章（从已发布列表移除，不撤回群发）。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| article_id | string | 是 | 发布文章 article_id |

**返回：**
```
已发布文章 art_abc123 已删除
```

---

## 错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| WECHAT_001 | AppID 或 AppSecret 未配置 | 调用 `wechat_auth_configure` |
| WECHAT_002 | Access Token 过期或刷新失败 | 检查凭据，调用 `wechat_auth_refresh` |
| WECHAT_003 | 文件上传失败（大小/格式/路径） | 检查文件大小、格式、路径合法性 |
| WECHAT_004 | 草稿创建失败 | 检查图文内容格式 |
| WECHAT_005 | 发布失败 | 检查公众号权限和内容合规 |
| WECHAT_006 | 网络错误或微信 API 返回错误 | 检查网络连接，查看 errcode 详情 |

**错误格式**：
```
[WECHAT_XXX] 具体错误信息
```
