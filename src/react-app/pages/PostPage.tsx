import { Link } from "../components/Link";
import { formatDate, useApi, useDocumentMeta } from "../lib/api";
import type { Post } from "../../shared/types";

interface PostPageProps {
	slug: string;
}

export function PostPage({ slug }: PostPageProps) {
	const { data, loading, error } = useApi<Post>(`/api/posts/${encodeURIComponent(slug)}`);

	useDocumentMeta(
		data ? `${data.title} · Peter's Blog` : "文章 · Peter's Blog",
		data?.excerpt,
	);

	if (loading) {
		return <p className="state">正在加载…</p>;
	}

	if (error || !data) {
		return (
			<section className="not-found">
				<p className="eyebrow">404</p>
				<h1>这篇文章不见了</h1>
				<p>它可能被移动、删除，或者从来没有存在过。</p>
				<Link to="/" className="button">
					回到首页
				</Link>
			</section>
		);
	}

	return (
		<article className="post">
			<header className="post-header">
				<Link to="/archive" className="back">
					← 全部文章
				</Link>
				<h1>{data.title}</h1>
				<div className="post-meta">
					<time dateTime={data.date}>{formatDate(data.date)}</time>
					<span aria-hidden="true">·</span>
					<span>{data.readingTime} 分钟阅读</span>
				</div>
				<ul className="tags">
					{data.tags.map((tag) => (
						<li key={tag}>{tag}</li>
					))}
				</ul>
			</header>

			<div className="prose" dangerouslySetInnerHTML={{ __html: data.html }} />

			<footer className="post-footer">
				<Link to="/" className="button ghost">
					← 回到首页
				</Link>
				<Link to="/archive" className="text-link">
					更多文章 →
				</Link>
			</footer>
		</article>
	);
}
