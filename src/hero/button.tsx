import type { ComponentProps, FC } from 'react';

// How a button looks, by what it sits on.
type ButtonVariant =
	// The main action on a card.
	| 'primary'
	// A quiet action on a card, as a link.
	| 'link'
	// Over the 3D scene, like the HUD's way out.
	| 'glass'
	// The main action over the photo or scene's dark gradient.
	| 'onScrim'
	// Other actions over that gradient.
	| 'glassOnScrim';

const variants: Record<ButtonVariant, string> = {
	primary: 'bg-ink font-semibold text-paper hover:bg-ink/85',
	link: 'rounded-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline',
	glass: 'bg-surface/70 text-ink backdrop-blur-sm hover:bg-surface/90',
	onScrim: 'bg-snow font-semibold text-scrim hover:bg-snow/85',
	glassOnScrim:
		'border border-snow/40 bg-snow/15 font-semibold text-snow backdrop-blur-md hover:bg-snow/25',
};

// Every button: a pointer, and the site's focus ring.
const base =
	'cursor-pointer focus-visible:ring-4 focus-visible:ring-accent/70 focus-visible:outline-none';

interface Props extends ComponentProps<'button'> {
	variant: ButtonVariant;
}

/**
 * A button in the hero, in the site's colours. Its shape and size (padding,
 * rounding, text size) come from `className`, as they differ by place.
 * @param props - The button's props, as for `<button>`.
 * @param props.variant - How it looks, by what it sits on.
 * @param props.className - Its shape and size.
 * @param props.type - A plain button unless it says otherwise.
 * @returns The button.
 */
export const Button: FC<Props> = ({
	variant,
	className = '',
	type = 'button',
	...props
}) => (
	<button
		type={type}
		className={`${base} ${variants[variant]} ${className}`}
		{...props}
	/>
);
