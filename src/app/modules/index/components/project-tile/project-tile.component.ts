import {
	ChangeDetectionStrategy,
	Component,
	HostBinding,
	Input,
} from '@angular/core';

import { Project } from '@app-models/project';

@Component({
	selector: 'portfolio-project-tile',
	templateUrl: './project-tile.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTileComponent {
	@HostBinding('class.notification')
	static readonly CLASS_NOTIFICATION = true;

	@Input()
	project!: Project;

	@Input()
	theme = '';
}
