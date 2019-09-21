import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import projects from '../../../assets/data/projects.json';
import { Project } from '../../models/project';

@Injectable({
	providedIn: 'root',
})
export class ProjectService {
	projects: Project[] = projects;

	getProjects(): Observable<Project[]> {
		return of(this.projects);
	}

	getProject(id: string): Observable<Project> {
		return of(this.projects.find((value) => value.id === id));
	}
}
