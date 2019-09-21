import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../shared/shared.module';

import { ProjectComponent } from './project.component';

@NgModule({
	declarations: [ProjectComponent],
	imports: [
		// Angular Modules
		CommonModule,
		RouterModule.forChild([
			{
				path: ':id',
				component: ProjectComponent,
			},
		]),
		// Application Modules
		SharedModule,
	],
})
export class ProjectModule {}
