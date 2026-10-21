import { Link } from "../components/Link";
import { formatDate, useApi, useDocumentMeta } from "../lib/api";
import type { PostSummary } from "../../shared/types";

export function Home() {
	const { data, loading, error } = useApi<PostSummary[]>("/api/posts");

	useDocumentMeta(
		"Peter's Blog · 在边缘写点东西",
		"关于代码、产品与日常的记录。站点部署在 Cloudflare 的全球网络上。",
	);

	return (
		<>
			<section className="hero">
				<p className="eyebrow">PETER'S BLOG</p>
				<h1>
					在边缘，
					<br />
					写点东西。
				</h1>
				<p className="lede">
					关于代码、产品与日常的记录。没有服务器需要照顾，
					站点跑在 Cloudflare 的全球网络上，离你更近一点。
				</p>
				<div className="hero-actions">
					<Link to="/archive" className="button">
						浏览全部文章
					</Link>
					<Link to="/about" className="text-link">
						关于我 →
					</Link>
				</div>
			</section>

			<section className="feed" aria-labelledby="latest">
				<div className="section-head">
					<h2 id="latest">最新文章</h2>
					<span className="muted">{data ? `${data.length} 篇` : ""}</span>
				</div>

				{loading && <p className="state">正在加载…</p>}
				{error && <p className="state error">{error}</p>}

				{data?.map((post) => (
					<article className="post-item" key={post.slug}>
						<div className="post-meta">
							<time dateTime={post.date}>{formatDate(post.date)}</time>
							<span aria-hidden="true">·</span>
							<span>{post.readingTime} 分钟</span>
						</div>
						<h2>
							<Link to={`/posts/${post.slug}`}>{post.title}</Link>
						</h2>
						<p>{post.excerpt}</p>
						<ul className="tags">
							{post.tags.map((tag) => (
								<li key={tag}>{tag}</li>
							))}
						</ul>
					</article>
				))}
			</section>
		</>
	);
}
