import { Hono } from "hono";
import { getPost, listPosts, listTags } from "./posts";

const app = new Hono<{ Bindings: Env }>();

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
