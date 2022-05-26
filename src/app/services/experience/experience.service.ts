import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';

import type { Experience } from '@app-models/experience';
import type { DataRef } from '@app-refs/data.ref';

/**
 * Personal experience service
 */
@Injectable({
	providedIn: 'root',
})
export class ExperienceService {
	constructor(private dataRef: DataRef) {}

	/**
	 * Gets all experiences
	 *
	 * @returns Array of all experiences
	 */
	getExperiences(): Observable<Experience[]> {
		return this.dataRef.getExperiences();
	}

	/**
	 * Gets a specific experience
	 *
	 * @param id - Experience ID
	 * @returns Experience with given ID
	 */
	getExperience(id: string | null): Observable<Experience | null> {
		if (id === null) {
			return of(null);
		}
		return this.getExperiences().pipe(
			map(
				(experiences) =>
					experiences.find((experience) => experience.id === id) ??
					null,
			),
		);
	}
}
