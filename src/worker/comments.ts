export interface CommentInput {
	author: string;
	body: string;
	website?: string;
}

export interface CommentRecord {
	id: number;
	author: string;
	body: string;
	created_at: string;
}

export interface ModerationRecord extends CommentRecord {
	post_slug: string;
	status: string;
}

export const COMMENT_STATUSES = ["pending", "approved", "spam", "deleted"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const MAX_AUTHOR_LENGTH = 40;
export const MAX_BODY_LENGTH = 2000;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_COMMENTS = 5;
const APPROVED_PAGE_SIZE = 100;

export class ValidationError extends Error {
	readonly status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = "ValidationError";
		this.status = status;
	}
}

export function isCommentStatus(value: unknown): value is CommentStatus {
	return (
		typeof value === "string" && COMMENT_STATUSES.includes(value as CommentStatus)
	);
}

function normalizeText(value: string): string {
	return value.replace(/\r\n?/g, "\n").trim();
}

function validate(input: CommentInput): { author: string; body: string } {
	const author = normalizeText(input.author);
	const body = normalizeText(input.body);

	if (!author) {
		throw new ValidationError("请填写昵称");
	}

	if (author.length > MAX_AUTHOR_LENGTH) {
		throw new ValidationError(`昵称最长 ${MAX_AUTHOR_LENGTH} 个字符`);
	}

	if (!body) {
		throw new ValidationError("请填写评论内容");
	}

	if (body.length > MAX_BODY_LENGTH) {
		throw new ValidationError(`评论最长 ${MAX_BODY_LENGTH} 个字符`);
	}

	return { author, body };
}

async function checkRateLimit(db: D1Database, ipHash: string | null): Promise<void> {
	if (!ipHash) return;

	const recent = await db
		.prepare(
			`SELECT COUNT(*) AS n
			 FROM comments
			 WHERE ip_hash = ?1
			   AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?2)`,
		)
		.bind(ipHash, `-${RATE_LIMIT_WINDOW_MINUTES} minutes`)
		.first<{ n: number }>();

	if ((recent?.n ?? 0) >= RATE_LIMIT_MAX_COMMENTS) {
		throw new ValidationError("提交太频繁了，请稍后再试", 429);
	}
}

export async function listApprovedComments(
	db: D1Database,
	slug: string,
): Promise<CommentRecord[]> {
	const { results } = await db
		.prepare(
			`SELECT id, author, body, created_at
			 FROM comments
			 WHERE post_slug = ?1 AND status = 'approved'
			 ORDER BY created_at DESC, id DESC
			 LIMIT ?2`,
		)
		.bind(slug, APPROVED_PAGE_SIZE)
		.all<CommentRecord>();

	return results;
}

export async function createComment(
	db: D1Database,
	slug: string,
	input: CommentInput,
	ipHash: string | null,
): Promise<{ author: string; body: string }> {
	const { author, body } = validate(input);

	await checkRateLimit(db, ipHash);

	await db
		.prepare(
			`INSERT INTO comments (post_slug, author, body, ip_hash, status)
			 VALUES (?1, ?2, ?3, ?4, 'pending')`,
		)
		.bind(slug, author, body, ipHash)
		.run();

	return { author, body };
}

export async function listCommentsForModeration(
	db: D1Database,
	status: CommentStatus,
): Promise<ModerationRecord[]> {
	const { results } = await db
		.prepare(
			`SELECT id, post_slug, author, body, status, created_at
			 FROM comments
			 WHERE status = ?1
			 ORDER BY created_at DESC, id DESC
			 LIMIT 500`,
		)
		.bind(status)
		.all<ModerationRecord>();

	return results;
}

export async function setCommentStatus(
	db: D1Database,
	id: number,
	status: CommentStatus,
): Promise<boolean> {
	const result = await db
		.prepare(`UPDATE comments SET status = ?1 WHERE id = ?2`)
		.bind(status, id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}
