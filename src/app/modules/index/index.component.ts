import {
	animate,
	state,
	style,
	transition,
	trigger,
} from '@angular/animations';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { interval, Observable } from 'rxjs';
import { SubSink } from 'subsink';

import { Education } from '@app-models/education';
import { Experience } from '@app-models/experience';
import { Project } from '@app-models/project';
import { EducationService } from '@app-services/education/education.service';
import { ExperienceService } from '@app-services/experience/experience.service';
import { ProjectService } from '@app-services/project/project.service';

import { shuffle } from '../../helpers';

@Component({
	selector: 'portfolio-index',
	templateUrl: './index.component.html',
	styleUrls: ['./index.component.scss'],
	animations: [
		trigger('flash', [
			state(
				'void',
				style({
					textShadow:
						'-{{ stroke }} -{{ stroke }},' +
						'-{{ stroke }} {{ stroke }},' +
						'{{ stroke }} -{{ stroke }},' +
						'{{ stroke }} {{ stroke }}',
					opacity: 0,
				}),
				{ params: { stroke: '0.1rem' } },
			),
			state(
				'*',
				style({
					textShadow: 'none',
					opacity: 1,
				}),
			),
			transition('void => *', animate('256ms 256ms ease-in-out')),
			transition('* => void', animate('256ms ease-in-out')),
		]),
	],
})
export class IndexComponent implements OnInit, OnDestroy {
	themes = [
		'pastel-orange',
		'pastel-green',
		'pastel-teal',
		'pastel-lilac',
		'pastel-yellow',
	];
	themeIndex = Math.floor(Math.random() * this.themes.length);
	titles = shuffle([
		'full-stack developer',
		'technology enthusiast',
		'web designer',
		'football fanatic',
	]);
	titleIndex = 0;
	educations$?: Observable<Education[]>;
	experiences$?: Observable<Experience[]>;
	projects$?: Observable<Project[]>;

	private subs = new SubSink();

	constructor(
		private educationService: EducationService,
		private experienceService: ExperienceService,
		private projectService: ProjectService,
	) {}

	get theme(): string {
		return this.themes[this.themeIndex] || '';
	}

	ngOnInit(): void {
		this.subs.sink = interval(2048).subscribe(() => {
			this.titleIndex =
				this.titleIndex + 2 > this.titles.length
					? 0
					: this.titleIndex + 1;
		});
		this.educations$ = this.educationService.getEducations();
		this.experiences$ = this.experienceService.getExperiences();
		this.projects$ = this.projectService.getProjects();
	}

	ngOnDestroy(): void {
		this.subs.unsubscribe();
	}
}
