import { TestBed } from '@angular/core/testing';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';
import { SubSink } from 'subsink';

import type { Education } from '@app-models/education';
import { DataRef } from '@app-refs/data.ref';

import { EducationService } from './education.service';

describe('EducationService', () => {
	let service: EducationService;

	const subs = new SubSink();

	const mockGetEducations = new BehaviorSubject<Education[]>([]);

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				MockProvider(DataRef, {
					getEducations: () => mockGetEducations.asObservable(),
				}),
			],
		});
		service = TestBed.inject(EducationService);
	});

	afterEach(() => {
		subs.unsubscribe();
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should #getEducations', (done) => {
		subs.sink = service.getEducations().subscribe((educations) => {
			expect(educations).toBeTruthy();
			done();
		});
	});

	it('should return null when #getEducation is called with a null id', (done) => {
		subs.sink = service.getEducation(null).subscribe((education) => {
			expect(education).toBeNull();
			done();
		});
	});

	it('should find and return a value when #getEducation is called', (done) => {
		mockGetEducations.next([
			{
				id: 'test1',
				title: 'Test',
				description: 'Test test test.',
			},
		]);

		subs.sink = service.getEducation('test1').subscribe((education) => {
			expect(education).toBeTruthy();
			done();
		});
	});

	it('should return null when #getEducation is called with a non-existent id', (done) => {
		mockGetEducations.next([
			{
				id: 'test1',
				title: 'Test',
				description: 'Test test test.',
			},
		]);

		subs.sink = service.getEducation('test2').subscribe((education) => {
			expect(education).toBeNull();
			done();
		});
	});
});
