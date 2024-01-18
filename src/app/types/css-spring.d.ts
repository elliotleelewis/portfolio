/**
 * Types for the `css-spring` package from NPM.
 */
declare module 'css-spring' {
	export interface Options {
		precision?: number;
		preset?: 'stiff' | 'gentle' | 'wobbly' | 'nowobble';
		stiffness?: number;
		damping?: number;
	}

	export default function spring<T>(
		start: T,
		target: T,
		options?: Options,
	): Record<string, T>;
}
