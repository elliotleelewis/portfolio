import type { FC, ReactNode } from 'react';

/**
 * An icon, drawn in the text's colour.
 * @param props - Component props.
 * @param props.children - Its lines.
 * @returns The icon.
 */
export const Icon: FC<{ children: ReactNode }> = ({ children }) => (
	<svg
		viewBox="0 0 24 24"
		className="size-4.5"
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		{children}
	</svg>
);
