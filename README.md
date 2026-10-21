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
| `/api/tags` | 标签及数量 |
| `/rss.xml` | RSS 2.0 |
| `/sitemap.xml` | Sitemap |

`wrangler.json` 中的 `assets.run_worker_first` 只把 `/api/*`、`/rss.xml`、`/sitemap.xml` 交给 Worker，其余请求由静态资源处理，并通过 `not_found_handling: "single-page-application"` 回退到 `index.html`，因此前端路由可以直接访问和刷新。
