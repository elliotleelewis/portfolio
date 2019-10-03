import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import projects from '../../../assets/data/projects.json';
import { Project } from '../../models/project';

/**
 * Personal project service
 */
@Injectable({
	providedIn: 'root',
})
export class ProjectService {
	private readonly projects: Project[] = projects;

	/**
	 * Gets all projects
	 * @returns Array of all projects
	 */
	getProjects(): Observable<Project[]> {
		return of(this.projects);
	}

	/**
	 * Gets a specific project
	 * @param id - Project ID
	 * @returns Project with given ID
	 */
	getProject(id: string): Observable<Project> {
		return of(this.projects.find((value) => value.id === id));
	}
}
