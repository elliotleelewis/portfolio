import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Education } from '@app-models/education';

/**
 * Personal education service
 */
@Injectable({
	providedIn: 'root',
})
export class EducationService {
	/**
	 * Gets all educations
	 *
	 * @returns Array of all educations
	 */
	getEducations(): Observable<Education[]> {
		return from(import('@app-data/educations.json')).pipe(
			map((module) => module.default),
		);
	}

	/**
	 * Gets a specific education
	 *
	 * @param id - Education ID
	 * @returns Education with given ID
	 */
	getEducation(id: string): Observable<Education | null> {
		return this.getEducations().pipe(
			map((e) => e.find((education) => education.id === id) ?? null),
		);
	}
}
