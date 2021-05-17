import { TestBed, waitForAsync } from '@angular/core/testing';
import { of } from 'rxjs';

import { DataRef } from '@app-refs/data.ref';

import { EducationService } from './education.service';

describe('EducationService', () => {
	let service: EducationService;

	let mockDataRef: jasmine.SpyObj<DataRef>;

	beforeEach(() => {
		mockDataRef = jasmine.createSpyObj<DataRef>(['getEducations']);
		mockDataRef.getEducations.and.returnValue(of([]));

		TestBed.configureTestingModule({
			providers: [{ provide: DataRef, useValue: mockDataRef }],
		});
		service = TestBed.inject(EducationService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it(
		'should #getEducations',
		waitForAsync(() => {
			service.getEducations().subscribe((educations) => {
				expect(educations).toBeTruthy();
			});
		}),
	);

	it(
		'should return null when #getEducation is called with a null id',
		waitForAsync(() => {
			service.getEducation(null).subscribe((education) => {
				expect(education).toBeNull();
			});
		}),
	);

	it(
		'should find and return a value when #getEducation is called',
		waitForAsync(() => {
			mockDataRef.getEducations.and.returnValue(
				of([
					{
						id: 'test1',
						title: 'Test',
						description: 'Test test test.',
					},
				]),
			);
			service.getEducation('test1').subscribe((education) => {
				expect(education).toBeTruthy();
			});
		}),
	);

	it(
		'should return null when #getEducation is called with a non-existent id',
		waitForAsync(() => {
			mockDataRef.getEducations.and.returnValue(
				of([
					{
						id: 'test1',
						title: 'Test',
						description: 'Test test test.',
					},
				]),
			);
			service.getEducation('test2').subscribe((education) => {
				expect(education).toBeNull();
			});
		}),
	);
});
