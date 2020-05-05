import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { IfChangesDirective } from './directives/if-changes/if-changes.directive';

/**
 * Shared module
 */
@NgModule({
	declarations: [
		// Directives
		IfChangesDirective,
	],
	imports: [
		// Angular Modules
		CommonModule,
	],
	exports: [
		// Directives
		IfChangesDirective,
	],
})
export class SharedModule {}
