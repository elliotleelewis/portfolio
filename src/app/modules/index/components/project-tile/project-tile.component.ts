import { Component, HostBinding, Input } from '@angular/core';

import { Project } from '../../../../models/project';

@Component({
	selector: 'portfolio-project-tile',
	templateUrl: './project-tile.component.html',
	styleUrls: ['./project-tile.component.scss'],
})
export class ProjectTileComponent {
	@Input()
	project: Project;
	@Input()
	theme = '';

	@HostBinding('class.notification')
	classNotification = true;
}
