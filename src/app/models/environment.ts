import { ModuleWithProviders, Provider, Type } from '@angular/core';

/**
 * Environment settings model
 */
export interface Environment {
	/**
	 * Production build flag
	 */
	production: boolean;
	/**
	 * Environment-specific imports for Application's NgModule
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	imports?: (Type<any> | ModuleWithProviders<any> | any[])[];
	/**
	 * Environment-specific providers for Application's NgModule
	 */
	providers?: Provider[];
}
