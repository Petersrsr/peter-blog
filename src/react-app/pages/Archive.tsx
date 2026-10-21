import { Link } from "../components/Link";
import { formatShortDate, useApi, useDocumentMeta } from "../lib/api";
import type { PostSummary } from "../../shared/types";

export function Archive() {
	const { data, loading, error } = useApi<PostSummary[]>("/api/posts");

	useDocumentMeta("文章归档 · Peter's Blog", "按年份浏览全部文章。");

	const groups = (data ?? []).reduce<Record<string, PostSummary[]>>((acc, post) => {
		const year = Number.isNaN(new Date(post.date).getTime())
			? "未分类"
			: String(new Date(post.date).getFullYear());
		(acc[year] ??= []).push(post);
		return acc;
	}, {});

	const years = Object.keys(groups).sort((a, b) => Number(b) - Number(a));

	return (
		<>
			<header className="page-head">
				<p className="eyebrow">ARCHIVE</p>
				<h1>文章归档</h1>
				<p>写下的东西都在这里。共 {data?.length ?? 0} 篇。</p>
			</header>

			{loading && <p className="state">正在加载…</p>}
			{error && <p className="state error">{error}</p>}

			{years.map((year) => (
				<section className="year-group" key={year}>
					<h2>{year}</h2>
					<ul className="archive-list">
						{groups[year].map((post) => (
							<li key={post.slug}>
								<time dateTime={post.date}>{formatShortDate(post.date)}</time>
								<Link to={`/posts/${post.slug}`}>{post.title}</Link>
							</li>
						))}
					</ul>
				</section>
			))}
		</>
	);
}
