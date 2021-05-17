import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { Project } from '@app-models/project';
import { DataRef } from '@app-refs/data.ref';

/**
 * Personal project service
 */
@Injectable({
	providedIn: 'root',
})
export class ProjectService {
	constructor(private dataRef: DataRef) {}

	/**
	 * Gets all projects
	 *
	 * @returns Array of all projects
	 */
	getProjects(): Observable<Project[]> {
		return this.dataRef.getProjects();
	}

	/**
	 * Gets a specific project
	 *
	 * @param id - Project ID
	 * @returns Project with given ID
	 */
	getProject(id: string | null): Observable<Project | null> {
		if (id === null) {
			return of(null);
		}
		return this.getProjects().pipe(
			map((p) => p.find((project) => project.id === id) ?? null),
		);
	}
}
