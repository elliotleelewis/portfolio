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
	imports?: (Type<any> | ModuleWithProviders<{}> | any[])[];
	/**
	 * Environment-specific providers for Application's NgModule
	 */
	providers?: Provider[];
}
