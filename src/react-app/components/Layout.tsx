import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "./Link";
import { usePathname } from "../lib/router";

const NAV = [
	{ href: "/", label: "首页" },
	{ href: "/archive", label: "归档" },
	{ href: "/about", label: "关于" },
];

function initialTheme(): "light" | "dark" {
	const stored = document.documentElement.dataset.theme;
	if (stored === "light" || stored === "dark") return stored;

	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function SunIcon() {
	return (
		<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
		</svg>
	);
}

export function Layout({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const [theme, setTheme] = useState(initialTheme);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		window.localStorage.setItem("theme", theme);
	}, [theme]);

	const isActive = (href: string) =>
		href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

	return (
		<div className="site">
			<header className="site-header">
				<div className="header-inner">
					<Link to="/" className="brand">
						Peter<span className="brand-dot">.</span>
					</Link>

					<nav className="site-nav" aria-label="主导航">
						{NAV.map((item) => (
							<Link
								key={item.href}
								to={item.href}
								aria-current={isActive(item.href) ? "page" : undefined}
							>
								{item.label}
							</Link>
						))}
					</nav>

					<button
						type="button"
						className="theme-toggle"
						onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
						aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
						title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
					>
						{theme === "dark" ? <SunIcon /> : <MoonIcon />}
					</button>
				</div>
			</header>

			<main className="site-main">
				<div className="container">{children}</div>
			</main>

			<footer className="site-footer">
				<div className="footer-inner">
					<p>© {new Date().getFullYear()} Peter's Blog</p>
					<p className="footer-links">
						<a href="/rss.xml">RSS</a>
						<span aria-hidden="true">·</span>
						<span>Powered by Cloudflare Workers</span>
					</p>
				</div>
			</footer>
		</div>
	);
}
