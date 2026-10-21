import { Link } from "../components/Link";
import { useDocumentMeta } from "../lib/api";

export function About() {
	useDocumentMeta("关于 · Peter's Blog", "关于这个博客和我。");

	return (
		<>
			<header className="page-head">
				<p className="eyebrow">ABOUT</p>
				<h1>关于</h1>
				<p>一个写代码的人，和他的一些记录。</p>
			</header>

			<div className="prose">
				<p>
					你好，我是 Peter。这里是我的个人博客，用来存放一些关于技术、产品和日常生活的思考。
				</p>

				<h2>关于这个站点</h2>
				<p>
					这个博客使用 Vite、React 和 Hono 构建，部署在 Cloudflare Workers 上。
					文章是仓库里的 Markdown 文件，没有数据库，也没有后台管理系统。
					想更新的时候，提交、构建、部署，然后继续去生活。
				</p>

				<h2>关于写作</h2>
				<p>
					我尽量只写自己真正想清楚的事情。不追热点，不凑字数，
					也不为了保持更新频率而发布半成品。
				</p>
				<p>
					如果某篇文章对你有帮助，或者你有不同的看法，欢迎通过站点域名找到我的联系方式。
				</p>

				<h2>关于技术栈</h2>
				<ul>
					<li>前端：React 19 + TypeScript + Vite</li>
					<li>后端：Hono，运行在 Cloudflare Workers</li>
					<li>内容：Markdown 文件，构建时渲染</li>
					<li>分发：Cloudflare 全球边缘网络</li>
				</ul>

				<blockquote>
					<p>工具应该退到背景里。你打开编辑器，写完，发布，然后去生活。</p>
				</blockquote>
			</div>

			<p className="about-cta">
				<Link to="/archive" className="button">
					去看看文章
				</Link>
			</p>
		</>
	);
}
