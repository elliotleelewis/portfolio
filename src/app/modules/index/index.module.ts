import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../shared/shared.module';

import { FaceComponent } from './components/face/face.component';
import { ProjectTileComponent } from './components/project-tile/project-tile.component';
import { IndexComponent } from './index.component';

/**
 * Index module
 */
@NgModule({
	declarations: [
		IndexComponent,
		// Components
		FaceComponent,
		ProjectTileComponent,
	],
	imports: [
		// Angular Modules
		CommonModule,
		RouterModule.forChild([
			{
				path: '',
				pathMatch: 'full',
				component: IndexComponent,
			},
		]),
		// Application Modules
		SharedModule,
	],
})
export class IndexModule {}
