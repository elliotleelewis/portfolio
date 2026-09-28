import { ParaglideMessage } from '@inlang/paraglide-js-react';
import type { ReactNode } from 'react';

import type { m } from '../paraglide/messages';

// Messages whose markup is only `strong` and `link`, with no inputs.
type RichMessage = (typeof m)[
	| 'trail_snap_event_insights'
	| 'trail_snap_payouts'
	| 'trail_snap_load_times'
	| 'trail_jabil_architect'
	| 'trail_jabil_redesign'];

interface Props {
	message: RichMessage;
	// Where a `link` in the message goes.
	href?: string;
}

/**
 * A message with bold words or a link in it, for Astro pages. Rendered to
 * HTML at build time, so it ships no JavaScript.
 * @param props - Component props.
 * @param props.message - The message.
 * @param props.href - Where a link in the message goes.
 * @returns The message.
 */
export const RichText = ({ message, href }: Props) => {
	// Every message gets both, whether or not it uses them.
	const markup = {
		strong: ({ children }: { children?: ReactNode }) => (
			<strong>{children}</strong>
		),
		link: ({ children }: { children?: ReactNode }) => (
			<a
				className="underline decoration-line underline-offset-2 hover:decoration-accent"
				href={href}
				target="_blank"
				rel="noopener noreferrer"
			>
				{children}
			</a>
		),
	};
	return <ParaglideMessage message={message} markup={markup} />;
};
