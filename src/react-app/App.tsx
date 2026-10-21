import { Layout } from "./components/Layout";
import { usePathname } from "./lib/router";
import { Home } from "./pages/Home";
import { PostPage } from "./pages/PostPage";
import { Archive } from "./pages/Archive";
import { About } from "./pages/About";
import { NotFound } from "./pages/NotFound";
import { Admin } from "./pages/Admin";
import "./App.css";

function App() {
	const pathname = usePathname();
	const path = pathname.replace(/\/+$/, "") || "/";
	const postMatch = /^\/posts\/([^/]+)$/.exec(path);

	let page = <NotFound />;

	if (postMatch) {
		const slug = decodeURIComponent(postMatch[1]);
		page = <PostPage key={slug} slug={slug} />;
	} else if (path === "/") {
		page = <Home />;
	} else if (path === "/archive") {
		page = <Archive />;
	} else if (path === "/about") {
		page = <About />;
	} else if (path === "/admin") {
		page = <Admin />;
	}

	return <Layout>{page}</Layout>;
}

export default App;
