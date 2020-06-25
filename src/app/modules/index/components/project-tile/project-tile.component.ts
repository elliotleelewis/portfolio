import { Component, HostBinding, Input } from '@angular/core';

import { Project } from '@app-models/project';

@Component({
	selector: 'portfolio-project-tile',
	templateUrl: './project-tile.component.html',
	styleUrls: ['./project-tile.component.scss'],
})
export class ProjectTileComponent {
	@HostBinding('class.notification')
	static readonly classNotification = true;

	@Input()
	project!: Project;
	@Input()
	theme = '';
}
