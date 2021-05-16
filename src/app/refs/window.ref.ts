import { Injectable } from '@angular/core';

/**
 * Ref for a `window` instance
 */
@Injectable({
	providedIn: 'root',
})
export class WindowRef {
	/**
	 * Gets a reference to the `window`
	 *
	 * @returns `window` instance
	 */
	getWindow(): Window {
		return window;
	}
}
