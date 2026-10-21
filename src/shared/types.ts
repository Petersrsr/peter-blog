export interface PostSummary {
	slug: string;
	title: string;
	date: string;
	tags: string[];
	excerpt: string;
	readingTime: number;
}

export interface Post extends PostSummary {
	html: string;
}
