import { Injectable } from '@angular/core';

/**
 * Ref for a `document` instance
 */
@Injectable({
	providedIn: 'root',
})
export class DocumentRef {
	/**
	 * Gets a reference to the `document`
	 *
	 * @returns `document` instance
	 */
	getDocument(): Document {
		return document;
	}
}
