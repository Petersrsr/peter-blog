# Peter's Blog

个人博客，部署在 Cloudflare Workers 上。

- **前端**：React 19 + TypeScript + Vite
- **后端**：Hono（Workers 运行时）
- **内容**：仓库内的 Markdown 文件，构建时解析渲染
- **线上地址**：<https://blog.peternet.xyz/>

没有数据库，也没有后台管理系统。写文章 = 新建一个 Markdown 文件。

## 开发

```bash
npm install
npm run dev      # http://localhost:5173
```

## 构建与部署

```bash
npm run build    # 类型检查 + 构建
npm run preview  # 本地预览生产构建
npm run check    # 类型检查 + 构建 + wrangler dry-run
npm run deploy   # 部署到 Cloudflare Workers
```

生产环境完全运行在 Cloudflare 上，不依赖任何源站服务器。部署需要先完成 Wrangler 登录：

```bash
npx wrangler login
```

## 写文章

在 `src/content/posts/` 下新建 `.md` 文件，文件名即文章 slug。支持的 frontmatter：

```markdown
---
title: 文章标题
date: 2026-10-21
tags: [标签一, 标签二]
excerpt: 列表页展示的摘要，可省略。
draft: false
---

正文使用 Markdown 编写。
```

`draft: true` 的文章不会出现在列表、RSS 和 Sitemap 中。

## 目录结构

```text
src/
├── content/posts/        # Markdown 文章
├── shared/types.ts       # 前后端共享类型
├── worker/
│   ├── index.ts          # Hono 路由：API / RSS / Sitemap
│   └── posts.ts          # Markdown 解析与文章索引
└── react-app/
    ├── components/       # Layout、Link
    ├── lib/              # 路由、数据请求、日期格式化
    ├── pages/            # 首页、文章、归档、关于、404
    ├── App.tsx           # 客户端路由
    ├── index.css         # 主题变量与基础样式
    └── App.css           # 布局与文章排版
```

## 路由

| 路径 | 说明 |
| --- | --- |
| `/` | 首页与最新文章 |
| `/posts/:slug` | 文章详情 |
| `/archive` | 按年份归档 |
| `/about` | 关于 |
| `/api/posts` | 文章列表 JSON |
| `/api/posts/:slug` | 文章详情 JSON（含渲染后的 HTML） |
| `/api/posts/:slug/comments` | GET 已审核评论 / POST 提交评论 |
| `/api/admin/comments` | GET 评论列表（需 `Authorization: Bearer <ADMIN_TOKEN>`） |
| `/api/admin/comments/:id` | POST 改评论状态 `pending`/`approved`/`spam`/`deleted` |
| `/api/tags` | 标签及数量 |
| `/rss.xml` | RSS 2.0 |
| `/sitemap.xml` | Sitemap |

`wrangler.json` 中的 `assets.run_worker_first` 只把 `/api/*`、`/rss.xml`、`/sitemap.xml` 交给 Worker，其余请求由静态资源处理，并通过 `not_found_handling: "single-page-application"` 回退到 `index.html`，因此前端路由可以直接访问和刷新。

## 数据库（D1）

评论存在 D1 里，绑定名 `DB`，库名 `blog`，库 ID `2f48d0ba-5a6e-443d-b938-7c6cc91a5c26`。正文仍然放在 Git 的 Markdown 中，D1 只存动态数据。

```bash
npx wrangler d1 migrations apply blog --local   # 本地开发
npx wrangler d1 migrations apply blog --remote  # 线上
```

新增迁移：

```bash
npx wrangler d1 create blog
npx wrangler d1 migrations create blog 0002_xxx
```

### 评论的生命周期

1. 读者提交 → 写入 `status = 'pending'`，前端提示"等待审核"
2. 管理端拉取待审列表 → 改为 `approved` / `spam`
3. 公开接口只返回 `approved`

提交接口的防护：正文 2000 字上限、蜜罐字段静默丢弃、同一 IP 10 分钟内最多 5 条。`IP_SALT` 存在时才会记录 `ip_hash` 并启用限流。

### 环境变量

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `ADMIN_TOKEN` | Secret | 管理端 Bearer Token，未设置时管理端一律返回 401 |
| `IP_SALT` | Secret | 用于给访客 IP 加盐哈希；不设置则不记录 IP、不限流 |

本地开发用 `.dev.vars`（已在 `.gitignore` 中）：

```bash
ADMIN_TOKEN=dev-admin-token-please-change
IP_SALT=local-dev-salt
```

线上用 `npx wrangler secret put ADMIN_TOKEN` 或在 Cloudflare 面板设置。

> `wrangler secret put` 会用当前配置重新部署 Worker。若刚改完代码想一次上线，先 `git push` 触发部署，再补 secret，避免用旧构建覆盖新代码。

### 审核一条评论

```bash
curl "https://blog.peternet.xyz/api/admin/comments" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -X POST "https://blog.peternet.xyz/api/admin/comments/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'
```

也可以直接用 Cloudflare 面板的 SQL 控制台：

```sql
UPDATE comments SET status = 'approved' WHERE status = 'pending';
```

### 待办

- 接入 Turnstile 替代蜜罐（需要 Turnstile site key / secret）
- 评论通知邮件（Queues + Email Workers）
- 用 D1 FTS5 的 `trigram` 分词器做中文全文搜索

