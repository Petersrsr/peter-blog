import { useEffect, useState } from "react";

export function useDocumentMeta(title: string, description?: string) {
	useEffect(() => {
		document.title = title;

		if (!description) return;

		let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
		if (!meta) {
			meta = document.createElement("meta");
			meta.name = "description";
			document.head.appendChild(meta);
		}
		meta.content = description;
	}, [title, description]);
}

export function useApi<T>(path: string) {
	const [state, setState] = useState<{
		path: string;
		data?: T;
		error?: string;
	}>({ path: "" });

	useEffect(() => {
		const controller = new AbortController();

		fetch(path, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(response.status === 404 ? "内容不存在" : `请求失败（${response.status}）`);
				}
				return (await response.json()) as T;
			})
			.then((data) => setState({ path, data }))
			.catch((error: unknown) => {
				if (error instanceof DOMException && error.name === "AbortError") return;
				setState({
					path,
					error: error instanceof Error ? error.message : "请求失败",
				});
			});

		return () => controller.abort();
	}, [path]);

	const loading = state.path !== path;

	return {
		data: loading ? undefined : state.data,
		error: loading ? undefined : state.error,
		loading,
	};
}

export function formatDate(date: string): string {
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return date;

	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(parsed);
}

export function formatShortDate(date: string): string {
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return date;

	return new Intl.DateTimeFormat("zh-CN", {
		month: "2-digit",
		day: "2-digit",
	}).format(parsed);
}
