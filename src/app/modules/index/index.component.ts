import {
	animate,
	state,
	style,
	transition,
	trigger,
} from '@angular/animations';
import { Component, OnDestroy, OnInit } from '@angular/core';

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
	themeIndex: number;
	titles = [
		'full-stack developer',
		'web developer',
		'football fanatic',
		'cook-at-home chef',
	];
	titleIndex = 0;
	projects: Project[] = null;

	private loop = null;

	constructor(private project: ProjectService) {}

	get theme(): string {
		switch (this.themeIndex) {
			case 1:
				return 'light-blue';
			case 2:
				return 'dark-green';
			case 3:
				return 'deep-red';
			case 4:
				return 'dusty-yellow';
			default:
				return 'salmon-pink';
		}
	}

	get themeIsLight(): boolean {
		return [3].indexOf(this.themeIndex) !== -1;
	}

	ngOnInit(): void {
		this.themeIndex = Math.floor(Math.random() * 5);
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
