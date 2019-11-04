import {
	animate,
	state,
	style,
	transition,
	trigger,
} from '@angular/animations';
import { Component, OnDestroy, OnInit } from '@angular/core';

import { shuffle } from '../../helpers';
import { Project } from '../../models/project';
import { ProjectService } from '../../services/project/project.service';

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
	titles = shuffle<string>([
		'full-stack developer',
		'technology enthusiast',
		'web designer',
		'football fanatic',
		'cook-at-home chef',
	]);
	titleIndex = 0;
	projects: Project[] = null;

	private loop = null;

	constructor(private project: ProjectService) {}

	get theme(): string {
		return this.themes[this.themeIndex] || null;
	}

	ngOnInit(): void {
		this.loop = setInterval(() => {
			this.titleIndex =
				this.titleIndex + 2 > this.titles.length
					? 0
					: this.titleIndex + 1;
		}, 2048);
		this.project.getProjects().subscribe((p) => (this.projects = p));
	}

	ngOnDestroy(): void {
		clearInterval(this.loop);
		this.loop = null;
	}
}
