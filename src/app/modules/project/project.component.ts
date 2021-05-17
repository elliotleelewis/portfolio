import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { SubSink } from 'subsink';

import { Project } from '@app-models/project';
import { ProjectService } from '@app-services/project/project.service';

@Component({
	selector: 'portfolio-project',
	templateUrl: './project.component.html',
	styleUrls: ['./project.component.scss'],
})
export class ProjectComponent implements OnInit, OnDestroy {
	project: Project | null = null;

	private subs = new SubSink();

	constructor(
		private activatedRoute: ActivatedRoute,
		private projectService: ProjectService,
	) {}

	ngOnInit(): void {
		this.subs.sink = this.activatedRoute.paramMap
			.pipe(
				switchMap((paramMap) =>
					this.projectService.getProject(paramMap.get('id')),
				),
			)
			.subscribe((p) => (this.project = p));
	}

	ngOnDestroy(): void {
		this.subs.unsubscribe();
	}
}
