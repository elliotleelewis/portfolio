/* istanbul ignore file */
import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';

import type { Education } from '@app-models/education';
import type { Experience } from '@app-models/experience';
import type { Project } from '@app-models/project';

@Injectable({
	providedIn: 'root',
})
export class DataRef {
	getEducations(): Observable<Education[]> {
		return from(import('@app-data/educations.json')).pipe(
			map((module) => module.default),
		);
	}

	getExperiences(): Observable<Experience[]> {
		return from(import('@app-data/experiences.json')).pipe(
			map((module) => module.default),
		);
	}

	getProjects(): Observable<Project[]> {
		return from(import('@app-data/projects.json')).pipe(
			map((module) => module.default),
		);
	}
}
