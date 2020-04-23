import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Project } from '@app-models/project';

/**
 * Personal project service
 */
@Injectable({
	providedIn: 'root',
})
export class ProjectService {
	/**
	 * Gets all projects
	 * @returns Array of all projects
	 */
	getProjects(): Observable<Project[]> {
		return from(import('@app-data/projects.json')).pipe(
			map((module) => module.default),
		);
	}

	/**
	 * Gets a specific project
	 * @param id - Project ID
	 * @returns Project with given ID
	 */
	getProject(id: string): Observable<Project | null> {
		return this.getProjects().pipe(
			map((p) => p.find((project) => project.id === id) ?? null),
		);
	}
}
