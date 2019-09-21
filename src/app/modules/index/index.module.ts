import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../shared/shared.module';

import { FaceComponent } from './components/face/face.component';
import { ProjectTileComponent } from './components/project-tile/project-tile.component';
import { IfChangesDirective } from './directives/if-changes/if-changes.directive';
import { IndexComponent } from './index.component';

@NgModule({
	declarations: [
		IndexComponent,
		// Components
		FaceComponent,
		ProjectTileComponent,
		// Directives
		IfChangesDirective,
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
