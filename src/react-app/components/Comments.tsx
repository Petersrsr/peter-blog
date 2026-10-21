import { useState } from "react";
import type { FormEvent } from "react";
import { formatDate, useApi } from "../lib/api";
import { MAX_AUTHOR_LENGTH, MAX_BODY_LENGTH } from "../../shared/constants";

interface CommentRecord {
	id: number;
	author: string;
	body: string;
	created_at: string;
}

export function Comments({ slug }: { slug: string }) {
	const { data, loading, error } = useApi<CommentRecord[]>(
		`/api/posts/${encodeURIComponent(slug)}/comments`,
	);

	const [author, setAuthor] = useState(() => window.localStorage.getItem("comment_author") ?? "");
	const [body, setBody] = useState("");
	const [website, setWebsite] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState("");
	const [formError, setFormError] = useState("");

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		setMessage("");
		setFormError("");

		try {
			const response = await fetch(`/api/posts/${encodeURIComponent(slug)}/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ author, body, website }),
			});

			const payload = (await response.json().catch(() => null)) as
				| { error?: string; message?: string }
				| null;

			if (!response.ok) {
				setFormError(payload?.error ?? "提交失败，请稍后再试。");
				return;
			}

			window.localStorage.setItem("comment_author", author.trim());
			setBody("");
			setMessage(payload?.message ?? "评论已提交，等待审核。");
		} catch {
			setFormError("网络异常，请稍后再试。");
		} finally {
			setSubmitting(false);
		}
	};

	const comments = data ?? [];

	return (
		<section className="comments" aria-labelledby="comments-title">
			<div className="section-head">
				<h2 id="comments-title">评论</h2>
				<span className="muted">{comments.length || ""}</span>
			</div>

			{loading && <p className="state">正在加载评论…</p>}
			{error && <p className="state">评论暂时不可用。</p>}

			{!loading && !error && comments.length === 0 && (
				<p className="state">还没有评论，来说第一句吧。</p>
			)}

			{comments.length > 0 && (
				<ul className="comment-list">
					{comments.map((comment) => (
						<li className="comment" key={comment.id}>
							<div className="comment-head">
								<strong>{comment.author}</strong>
								<time dateTime={comment.created_at}>
									{formatDate(comment.created_at)}
								</time>
							</div>
							<p>{comment.body}</p>
						</li>
					))}
				</ul>
			)}

			<form className="comment-form" onSubmit={handleSubmit}>
				<label>
					<span>昵称</span>
					<input
						type="text"
						name="author"
						value={author}
						onChange={(event) => setAuthor(event.target.value)}
						maxLength={MAX_AUTHOR_LENGTH}
						placeholder="怎么称呼你"
						required
					/>
				</label>

				<label>
					<span>评论</span>
					<textarea
						name="body"
						value={body}
						onChange={(event) => setBody(event.target.value)}
						maxLength={MAX_BODY_LENGTH}
						rows={5}
						placeholder="说点什么…"
						required
					/>
				</label>

				<div className="hp" aria-hidden="true">
					<label>
						网站
						<input
							type="text"
							name="website"
							value={website}
							onChange={(event) => setWebsite(event.target.value)}
							tabIndex={-1}
							autoComplete="off"
						/>
					</label>
				</div>

				<div className="form-actions">
					<button type="submit" className="button" disabled={submitting}>
						{submitting ? "提交中…" : "发表评论"}
					</button>
					<span className="muted">
						评论需要审核，不会立刻显示。
					</span>
				</div>

				{message && <p className="state ok">{message}</p>}
				{formError && <p className="state error">{formError}</p>}
			</form>
		</section>
	);
}
