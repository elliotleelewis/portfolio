import {
	animate,
	state,
	style,
	transition,
	trigger,
} from '@angular/animations';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map } from 'rxjs/operators';
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
	static readonly TITLE_INTERVAL = 2048;

	themes = [
		'is-pastel-orange',
		'is-pastel-green',
		'is-pastel-teal',
		'is-pastel-lilac',
		'is-pastel-yellow',
	];

	themeIndex = Math.floor(Math.random() * this.themes.length);

	titles = shuffle([
		'full-stack developer',
		'technology enthusiast',
		'web designer',
		'football fanatic',
	]);

	title$?: Observable<string | undefined>;
	educations$?: Observable<Education[]>;
	experiences$?: Observable<Experience[]>;
	projects$?: Observable<Project[]>;

	private _subs = new SubSink();

	constructor(
		private educationService: EducationService,
		private experienceService: ExperienceService,
		private projectService: ProjectService,
	) {}

	get theme(): string | undefined {
		return this.themes[this.themeIndex];
	}

	ngOnInit(): void {
		this.title$ = timer(0, IndexComponent.TITLE_INTERVAL).pipe(
			map((i) => i % this.titles.length),
			map((i) => this.titles[i]),
		);
		this.educations$ = this.educationService.getEducations();
		this.experiences$ = this.experienceService.getExperiences();
		this.projects$ = this.projectService.getProjects();
	}

	ngOnDestroy(): void {
		this._subs.unsubscribe();
	}
}
