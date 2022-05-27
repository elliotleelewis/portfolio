import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import type { Project } from '@app-models/project';
import { ProjectService } from '@app-services/project/project.service';

@Component({
	selector: 'portfolio-project',
	templateUrl: './project.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectComponent implements OnInit {
	project$!: Observable<Project | null>;

	constructor(
		@Inject(ActivatedRoute) private activatedRoute: ActivatedRoute,
		@Inject(ProjectService) private projectService: ProjectService,
	) {}

	ngOnInit(): void {
		this.project$ = this.activatedRoute.paramMap.pipe(
			switchMap((paramMap) =>
				this.projectService.getProject(paramMap.get('id')),
			),
		);
	}
}
