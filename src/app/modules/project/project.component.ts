import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { Project } from '@app-models/project';
import { ProjectService } from '@app-services/project/project.service';

@Component({
	selector: 'portfolio-project',
	templateUrl: './project.component.html',
	styleUrls: ['./project.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectComponent implements OnInit {
	project$!: Observable<Project | null>;

	constructor(
		private activatedRoute: ActivatedRoute,
		private projectService: ProjectService,
	) {}

	ngOnInit(): void {
		this.project$ = this.activatedRoute.paramMap.pipe(
			switchMap((paramMap) =>
				this.projectService.getProject(paramMap.get('id')),
			),
		);
	}
}
