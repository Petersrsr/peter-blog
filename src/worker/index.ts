import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getPost, listPosts, listTags } from "./posts";
import {
	createComment,
	isCommentStatus,
	listApprovedComments,
	listCommentsForModeration,
	setCommentStatus,
	ValidationError,
} from "./comments";
import type { CommentInput } from "./comments";

type Bindings = Env & {
	ADMIN_TOKEN?: string;
	IP_SALT?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const SITE = {
	name: "Peter's Blog",
	description: "关于代码、产品与日常的记录。",
};

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

async function hashIp(c: Context<{ Bindings: Bindings }>): Promise<string | null> {
	const salt = c.env.IP_SALT;
	const ip = c.req.header("CF-Connecting-IP");

	if (!salt || !ip) return null;

	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(`${salt}:${ip}`),
	);

	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function isAuthorized(c: Context<{ Bindings: Bindings }>): boolean {
	const token = c.env.ADMIN_TOKEN;
	if (!token) return false;

	return c.req.header("Authorization") === `Bearer ${token}`;
}

app.get("/api/", (c) => c.json({ name: SITE.name, status: "ok" }));

app.get("/api/posts", (c) =>
	c.json(listPosts(), 200, {
		"Cache-Control": "public, max-age=60, s-maxage=300",
	}),
);

app.get("/api/posts/:slug", (c) => {
	const post = getPost(c.req.param("slug"));

	if (!post) {
		return c.json({ error: "Post not found" }, 404);
	}

	return c.json(post, 200, {
		"Cache-Control": "public, max-age=60, s-maxage=300",
	});
});

app.get("/api/posts/:slug/comments", async (c) => {
	const slug = c.req.param("slug");

	if (!getPost(slug)) {
		return c.json({ error: "Post not found" }, 404);
	}

	const comments = await listApprovedComments(c.env.DB, slug);

	return c.json(comments, 200, {
		"Cache-Control": "public, max-age=30",
	});
});

app.post("/api/posts/:slug/comments", async (c) => {
	const slug = c.req.param("slug");

	if (!getPost(slug)) {
		return c.json({ error: "Post not found" }, 404);
	}

	const payload = (await c.req.json().catch(() => null)) as CommentInput | null;

	if (!payload || typeof payload !== "object") {
		return c.json({ error: "请求格式错误" }, 400);
	}

	// 蜜罐字段：机器人会填，人不会。静默丢弃，不告诉机器人它失败了。
	if (typeof payload.website === "string" && payload.website.trim()) {
		return c.json({ ok: true, pending: true }, 202);
	}

	try {
		const comment = await createComment(
			c.env.DB,
			slug,
			payload,
			await hashIp(c),
		);

		return c.json(
			{
				ok: true,
				pending: true,
				message: "评论已提交，等待审核。",
				comment,
			},
			201,
		);
	} catch (error) {
		if (error instanceof ValidationError) {
			return c.json({ error: error.message }, error.status as ContentfulStatusCode);
		}
		throw error;
	}
});

app.get("/api/admin/comments", async (c) => {
	if (!isAuthorized(c)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const status = c.req.query("status") ?? "pending";

	if (!isCommentStatus(status)) {
		return c.json({ error: "status 只能是 pending/approved/spam/deleted" }, 400);
	}

	return c.json(await listCommentsForModeration(c.env.DB, status));
});

app.post("/api/admin/comments/:id", async (c) => {
	if (!isAuthorized(c)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const id = Number(c.req.param("id"));

	if (!Number.isInteger(id) || id <= 0) {
		return c.json({ error: "无效的评论 ID" }, 400);
	}

	const payload = (await c.req.json().catch(() => null)) as { status?: unknown };

	if (!isCommentStatus(payload?.status)) {
		return c.json({ error: "status 只能是 pending/approved/spam/deleted" }, 400);
	}

	const changed = await setCommentStatus(c.env.DB, id, payload.status);

	if (!changed) {
		return c.json({ error: "评论不存在" }, 404);
	}

	return c.json({ ok: true, id, status: payload.status });
});

app.get("/api/tags", (c) => c.json(listTags()));

app.get("/rss.xml", (c) => {
	const origin = new URL(c.req.url).origin;
	const posts = listPosts();

	const items = posts
		.map(
			(post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${origin}/posts/${post.slug}</link>
      <guid isPermaLink="true">${origin}/posts/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`,
		)
		.join("\n");

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${origin}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>zh-CN</language>
${items}
  </channel>
</rss>`;

	return c.body(xml, 200, {
		"Content-Type": "application/rss+xml; charset=utf-8",
		"Cache-Control": "public, max-age=300",
	});
});

app.get("/sitemap.xml", (c) => {
	const origin = new URL(c.req.url).origin;
	const pages = ["", "/archive", "/about"];
	const urls = [
		...pages.map(
			(path) =>
				`  <url><loc>${origin}${path}</loc><changefreq>weekly</changefreq></url>`,
		),
		...listPosts().map(
			(post) =>
				`  <url><loc>${origin}/posts/${post.slug}</loc><lastmod>${post.date}</lastmod></url>`,
		),
	];

	return c.body(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`,
		200,
		{
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	);
});

app.notFound((c) => {
	if (c.req.path.startsWith("/api/")) {
		return c.json({ error: "Not Found" }, 404);
	}

	return c.text("Not Found", 404);
});

export default app;
