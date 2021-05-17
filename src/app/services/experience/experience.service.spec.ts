import { TestBed, waitForAsync } from '@angular/core/testing';
import { of } from 'rxjs';

import { DataRef } from '@app-refs/data.ref';

import { ExperienceService } from './experience.service';

describe('ExperienceService', () => {
	let service: ExperienceService;

	let mockDataRef: jasmine.SpyObj<DataRef>;

	beforeEach(() => {
		mockDataRef = jasmine.createSpyObj<DataRef>(['getExperiences']);
		mockDataRef.getExperiences.and.returnValue(of([]));

		TestBed.configureTestingModule({
			providers: [{ provide: DataRef, useValue: mockDataRef }],
		});
		service = TestBed.inject(ExperienceService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should #getExperiences', waitForAsync(() => {
		service.getExperiences().subscribe((experiences) => {
			expect(experiences).toBeTruthy();
		});
	}));

	it('should return null when #getExperience is called with a null id', waitForAsync(() => {
		service.getExperience(null).subscribe((experience) => {
			expect(experience).toBeNull();
		});
	}));

	it(
		'should find and return a value when #getExperiences is called',
		waitForAsync(() => {
			mockDataRef.getExperiences.and.returnValue(
				of([
					{
						id: 'test1',
						title: 'Test',
						description: 'Test test test.',
					},
				]),
			);
			service.getExperience('test1').subscribe((experience) => {
				expect(experience).toBeTruthy();
			});
		}),
	);

	it(
		'should return null when #getExperiences is called with a non-existent id',
		waitForAsync(() => {
			mockDataRef.getExperiences.and.returnValue(
				of([
					{
						id: 'test1',
						title: 'Test',
						description: 'Test test test.',
					},
				]),
			);
			service.getExperience('test2').subscribe((experience) => {
				expect(experience).toBeNull();
			});
		}),
	);
});
