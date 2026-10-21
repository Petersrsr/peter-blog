import { Link } from "../components/Link";
import { useDocumentMeta } from "../lib/api";

export function NotFound() {
	useDocumentMeta("页面不存在 · Peter's Blog");

	return (
		<section className="not-found">
			<p className="eyebrow">404</p>
			<h1>这里什么也没有</h1>
			<p>你访问的页面不存在，或者已经被移动到了别处。</p>
			<Link to="/" className="button">
				回到首页
			</Link>
		</section>
	);
}
