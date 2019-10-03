/**
 * Environment settings model
 */
export interface Environment {
	/**
	 * Production build flag
	 */
	production: boolean;
	/**
	 * Google Tag Manager container public ID.
	 */
	gtmContainerPublicId: string;
}
