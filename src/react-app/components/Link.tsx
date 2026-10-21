import type { MouseEvent, ReactNode } from "react";
import { navigate } from "../lib/router";

interface LinkProps {
	to: string;
	children: ReactNode;
	className?: string;
	"aria-current"?: "page" | undefined;
}

export function Link({ to, children, className, ...rest }: LinkProps) {
	const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		event.preventDefault();
		navigate(to);
	};

	return (
		<a href={to} className={className} onClick={onClick} {...rest}>
			{children}
		</a>
	);
}
