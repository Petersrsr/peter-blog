import { marked } from "marked";
import type { Post, PostSummary } from "../shared/types";

const files = import.meta.glob("../content/posts/*.md", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

type FrontmatterValue = string | string[] | boolean;

function parseFrontmatter(raw: string): { data: Record<string, FrontmatterValue>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
	if (!match) return { data: {}, body: raw };

	const data: Record<string, FrontmatterValue> = {};

	for (const line of match[1].split(/\r?\n/)) {
		const entry = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
		if (!entry) continue;

		const [, key, rawValue] = entry;
		let value = rawValue.trim();

		if (value.startsWith("[") && value.endsWith("]")) {
			data[key] = value
				.slice(1, -1)
				.split(",")
				.map((item) => item.trim().replace(/^["']|["']$/g, ""))
				.filter(Boolean);
			continue;
		}

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (value === "true" || value === "false") {
			data[key] = value === "true";
			continue;
		}

		data[key] = value;
	}

	return { data, body: match[2] };
}

function stripMarkdown(body: string): string {
	return body
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[#>*_`~|-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function readingTime(body: string): number {
	const cjk = (body.match(/[\u4e00-\u9fff]/g) ?? []).length;
	const words = body
		.replace(/[\u4e00-\u9fff]/g, " ")
		.split(/\s+/)
		.filter(Boolean).length;

	return Math.max(1, Math.round(cjk / 400 + words / 200));
}

function toPost(path: string, raw: string): Post | null {
	const { data, body } = parseFrontmatter(raw);
	if (data.draft === true) return null;

	const slug = path.split("/").pop()?.replace(/\.md$/, "") ?? "";
	const title = typeof data.title === "string" ? data.title : slug;
	const date = typeof data.date === "string" ? data.date : "";
	const tags = Array.isArray(data.tags) ? data.tags : [];
	const excerpt =
		typeof data.excerpt === "string" && data.excerpt
			? data.excerpt
			: `${stripMarkdown(body).slice(0, 120)}…`;

	return {
		slug,
		title,
		date,
		tags,
		excerpt,
		readingTime: readingTime(body),
		html: marked.parse(body, { async: false, gfm: true }) as string,
	};
}

const posts = Object.entries(files)
	.map(([path, raw]) => toPost(path, raw))
	.filter((post): post is Post => post !== null)
	.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export function listPosts(): PostSummary[] {
	return posts.map((post) => ({
		slug: post.slug,
		title: post.title,
		date: post.date,
		tags: post.tags,
		excerpt: post.excerpt,
		readingTime: post.readingTime,
	}));
}

export function getPost(slug: string): Post | undefined {
	return posts.find((post) => post.slug === slug);
}

export function listTags(): { name: string; count: number }[] {
	const counts = new Map<string, number>();

	for (const post of posts) {
		for (const tag of post.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
