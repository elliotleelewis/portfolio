import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Experience } from '@app-models/experience';

/**
 * Personal experience service
 */
@Injectable({
	providedIn: 'root',
})
export class ExperienceService {
	/**
	 * Gets all experiences
	 *
	 * @returns Array of all experiences
	 */
	getExperiences(): Observable<Experience[]> {
		return from(import('@app-data/experiences.json')).pipe(
			map((module) => module.default),
		);
	}

	/**
	 * Gets a specific experience
	 *
	 * @param id - Experience ID
	 * @returns Experience with given ID
	 */
	getExperience(id: string): Observable<Experience | null> {
		return this.getExperiences().pipe(
			map((e) => e.find((experience) => experience.id === id) ?? null),
		);
	}
}
