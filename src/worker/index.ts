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

function timingSafeEqual(a: string, b: string): boolean {
	const enc = new TextEncoder();
	const bufA = enc.encode(a);
	const bufB = enc.encode(b);

	// 长度不同时仍遍历一遍，避免通过耗时泄露长度。
	const len = Math.max(bufA.length, bufB.length);
	let diff = bufA.length ^ bufB.length;

	for (let i = 0; i < len; i += 1) {
		diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
	}

	return diff === 0;
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

async function isSessionValid(
	c: Context<{ Bindings: Bindings }>,
	session: string,
): Promise<boolean> {
	const token = c.env.ADMIN_TOKEN;
	if (!token) return false;

	const parts = session.split(".");
	if (parts.length !== 3) return false;

	const [issuedRaw, expiresRaw, signature] = parts;
	const issued = Number(issuedRaw);
	const expires = Number(expiresRaw);

	if (!Number.isFinite(issued) || !Number.isFinite(expires)) return false;
	if (expires <= Date.now() || Date.now() < issued) return false;
	if (expires - issued > 24 * 60 * 60 * 1000) return false;

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(token),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const expected = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${issuedRaw}.${expiresRaw}`),
	);
	const expectedHex = [...new Uint8Array(expected)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	if (expectedHex.length !== signature.length) return false;

	let diff = 0;
	for (let i = 0; i < expectedHex.length; i += 1) {
		diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
	}

	return diff === 0;
}

function getSession(c: Context<{ Bindings: Bindings }>): string | null {
	const header = c.req.header("Authorization");
	if (!header) return null;
	return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function ensureAdmin(
	c: Context<{ Bindings: Bindings }>,
): Promise<Response | null> {
	// 只接受 HMAC 签名的 session。密码本身绝不能作为凭证，
	// 否则任何拿到密码的人都能绕过 12 小时有效期与签名机制。
	const session = getSession(c);
	if (session && (await isSessionValid(c, session))) return null;

	return c.json({ error: "Unauthorized" }, 401);
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
	const denied = await ensureAdmin(c);
	if (denied) return denied;

	const status = c.req.query("status") ?? "pending";

	if (!isCommentStatus(status)) {
		return c.json({ error: "status 只能是 pending/approved/spam/deleted" }, 400);
	}

	return c.json(await listCommentsForModeration(c.env.DB, status));
});

app.post("/api/admin/comments/:id", async (c) => {
	const denied = await ensureAdmin(c);
	if (denied) return denied;

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

app.post("/api/admin/login", async (c) => {
	const expected = c.env.ADMIN_TOKEN;
	if (!expected) {
		return c.json({ error: "服务端未配置管理员口令" }, 503);
	}

	const body = (await c.req.json().catch(() => null)) as { password?: unknown } | null;
	const provided = typeof body?.password === "string" ? body.password : "";

	// 时间恒定比较，避免通过响应耗时逐字节猜出口令。
	if (!provided.length || !timingSafeEqual(provided, expected)) {
		return c.json({ error: "密码不正确" }, 401);
	}

	const ttl = 12 * 60 * 60 * 1000;
	const issued = Date.now();
	const sessionPayload = `${issued}.${issued + ttl}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(expected),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(sessionPayload),
	);
	const session = `${sessionPayload}.${[...new Uint8Array(signature)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`;

	return c.json({ ok: true, session, expiresInMs: ttl });
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
