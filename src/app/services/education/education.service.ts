import { Inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';

import type { Education } from '@app-models/education';
import { DataRef } from '@app-refs/data.ref';

/**
 * Personal education service
 */
@Injectable({
	providedIn: 'root',
})
export class EducationService {
	constructor(@Inject(DataRef) private dataRef: DataRef) {}

	/**
	 * Gets all educations
	 *
	 * @returns Array of all educations
	 */
	getEducations(): Observable<Education[]> {
		return this.dataRef.getEducations();
	}

	/**
	 * Gets a specific education
	 *
	 * @param id - Education ID
	 * @returns Education with given ID
	 */
	getEducation(id: string | null): Observable<Education | null> {
		if (id === null) {
			return of(null);
		}
		return this.getEducations().pipe(
			map(
				(educations) =>
					educations.find((education) => education.id === id) ?? null,
			),
		);
	}
}
