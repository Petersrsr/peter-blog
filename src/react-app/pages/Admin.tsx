import { useCallback, useEffect, useState } from "react";
import { Link } from "../components/Link";
import { useDocumentMeta } from "../lib/api";

const SESSION_KEY = "admin_session";
const STATUSES = ["pending", "approved", "spam"] as const;
type StatusFilter = (typeof STATUSES)[number];

interface ModerationRecord {
	id: number;
	post_slug: string;
	author: string;
	body: string;
	status: string;
	created_at: string;
}

const LABEL: Record<string, string> = {
	pending: "待审核",
	approved: "已通过",
	spam: "垃圾",
	deleted: "已删除",
};

function readSession(): string | null {
	return window.localStorage.getItem(SESSION_KEY);
}

async function adminFetch(path: string, session: string, init?: RequestInit) {
	return fetch(path, {
		...init,
		headers: {
			...(init?.headers ?? {}),
			Authorization: `Bearer ${session}`,
		},
	});
}

function Login({ onSuccess }: { onSuccess: (session: string) => void }) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setBusy(true);
		setError("");

		try {
			const response = await fetch("/api/admin/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});

			if (!response.ok) {
				setError("密码不正确");
				return;
			}

			const payload = (await response.json()) as { session?: string };

			if (!payload.session) {
				setError("登录失败，请重试。");
				return;
			}

			onSuccess(payload.session);
		} catch {
			setError("网络异常，请稍后再试。");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="admin-wrap">
			<div className="admin-card">
				<p className="eyebrow">ADMIN</p>
				<h1>评论审核</h1>
				<span className="muted">请输入密码进入。</span>

				<form className="admin-form" onSubmit={handleSubmit}>
					<label>
						<span>密码</span>
						<input
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							autoFocus
							required
						/>
					</label>

					<button type="submit" className="button" disabled={busy || !password}>
						{busy ? "验证中…" : "进入审核"}
					</button>

					{error && <p className="state error">{error}</p>}
				</form>
			</div>
		</div>
	);
}

export function Admin() {
	const [session, setSession] = useState<string | null>(readSession);
	const [filter, setFilter] = useState<StatusFilter>("pending");
	const [items, setItems] = useState<ModerationRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [busyId, setBusyId] = useState<number | null>(null);

	useDocumentMeta("评论审核 · Peter's Blog");

	const load = useCallback(
		async (token: string, status: StatusFilter) => {
			setLoading(true);
			setError("");

			try {
				const response = await adminFetch(
					`/api/admin/comments?status=${status}`,
					token,
				);

				if (response.status === 401) {
					window.localStorage.removeItem(SESSION_KEY);
					setSession(null);
					return;
				}

				if (!response.ok) {
					setError("加载失败，请重试。");
					return;
				}

				setItems((await response.json()) as ModerationRecord[]);
			} catch {
				setError("网络异常，请稍后再试。");
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	useEffect(() => {
		if (session) void load(session, filter);
	}, [session, filter, load]);

	const setStatus = async (id: number, status: string) => {
		if (!session) return;

		setBusyId(id);

		try {
			const response = await adminFetch(`/api/admin/comments/${id}`, session, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status }),
			});

			if (response.status === 401) {
				window.localStorage.removeItem(SESSION_KEY);
				setSession(null);
				return;
			}

			if (!response.ok) {
				setError("操作失败，请重试。");
				return;
			}

			setItems((prev) => prev.filter((item) => item.id !== id));
		} catch {
			setError("网络异常，请稍后再试。");
		} finally {
			setBusyId(null);
		}
	};

	if (!session) {
		return (
			<Login
				onSuccess={(token) => {
					window.localStorage.setItem(SESSION_KEY, token);
					setSession(token);
				}}
			/>
		);
	}

	return (
		<div>
			<div className="section-head">
				<h2>评论审核</h2>
				<div className="admin-toolbar">
					{STATUSES.map((status) => (
						<button
							key={status}
							type="button"
							className="mod-filter"
							aria-pressed={filter === status}
							onClick={() => setFilter(status)}
						>
							{LABEL[status]}
						</button>
					))}
					<button
						type="button"
						className="mod-filter"
						onClick={() => {
							window.localStorage.removeItem(SESSION_KEY);
							setSession(null);
						}}
					>
						退出
					</button>
				</div>
			</div>

			{loading && <p className="state">正在加载…</p>}
			{error && <p className="state error">{error}</p>}

			{!loading && items.length === 0 && (
				<p className="mod-empty">没有{LABEL[filter]}的评论。</p>
			)}

			{items.length > 0 && (
				<ul className="comment-list">
					{items.map((item) => (
						<li className="comment" key={item.id}>
							<div className="comment-head">
								<strong>{item.author}</strong>
								<span className={`mod-badge ${item.status}`}>
									{LABEL[item.status] ?? item.status}
								</span>
								<span className="mod-slug">/posts/{item.post_slug}</span>
								<span className="muted">{item.created_at}</span>
							</div>
							<p>{item.body}</p>
							<div className="mod-actions">
								{item.status !== "approved" && (
									<button
										type="button"
										className="mod-btn approve"
										disabled={busyId === item.id}
										onClick={() => setStatus(item.id, "approved")}
									>
										通过
									</button>
								)}
								{item.status !== "spam" && (
									<button
										type="button"
										className="mod-btn spam"
										disabled={busyId === item.id}
										onClick={() => setStatus(item.id, "spam")}
									>
										垃圾
									</button>
								)}
								{item.status !== "pending" && (
									<button
										type="button"
										className="mod-btn"
										disabled={busyId === item.id}
										onClick={() => setStatus(item.id, "pending")}
									>
										退回待审
									</button>
								)}
								<button
									type="button"
									className="mod-btn"
									disabled={busyId === item.id}
									onClick={() => setStatus(item.id, "deleted")}
								>
									删除
								</button>
								<Link to={`/posts/${item.post_slug}`} className="mod-btn">
									查看文章
								</Link>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
