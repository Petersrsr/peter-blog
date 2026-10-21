import { useEffect, useState } from "react";

export function usePathname(): string {
	const [pathname, setPathname] = useState(() => window.location.pathname);

	useEffect(() => {
		const update = () => setPathname(window.location.pathname);
		window.addEventListener("popstate", update);
		return () => window.removeEventListener("popstate", update);
	}, []);

	return pathname;
}

export function navigate(to: string): void {
	if (to === window.location.pathname) return;

	window.history.pushState({}, "", to);
	window.dispatchEvent(new PopStateEvent("popstate"));
	window.scrollTo({ top: 0, behavior: "instant" });
}
