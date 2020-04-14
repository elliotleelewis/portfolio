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

	export function toString(
		keyframes: { [key: string]: object },
		formatter?: (property: string, value: any) => string,
	): string;

	export default function spring<T extends object>(
		start: T,
		target: T,
		options?: Options,
	): { [key: string]: T };
}
