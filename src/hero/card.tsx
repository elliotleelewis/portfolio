import type { ComponentProps, FC } from 'react';

/**
 * A card over the hero's 3D scene: the site's surface, a little see-through,
 * so it reads as part of the page in light and dark mode alike. Spacing
 * comes from `className`.
 * @param props - The card's props, as for `<div>`.
 * @param props.className - Its size and spacing.
 * @returns The card.
 */
export const Card: FC<ComponentProps<'div'>> = ({
	className = '',
	...props
}) => (
	<div
		className={`rounded-2xl bg-surface/85 text-ink shadow-2xl backdrop-blur-md ${className}`}
		{...props}
	/>
);
