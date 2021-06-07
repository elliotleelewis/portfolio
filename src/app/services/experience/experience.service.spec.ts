import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SubSink } from 'subsink';

import { DataRef } from '@app-refs/data.ref';

import { ExperienceService } from './experience.service';

describe('ExperienceService', () => {
	let service: ExperienceService;

	let mockDataRef: jasmine.SpyObj<DataRef>;

	const subs = new SubSink();

	beforeEach(() => {
		mockDataRef = jasmine.createSpyObj<DataRef>(['getExperiences']);
		mockDataRef.getExperiences.and.returnValue(of([]));

		TestBed.configureTestingModule({
			providers: [{ provide: DataRef, useValue: mockDataRef }],
		});
		service = TestBed.inject(ExperienceService);
	});

	afterEach(() => {
		subs.unsubscribe();
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should #getExperiences', (done) => {
		subs.sink = service.getExperiences().subscribe((experiences) => {
			expect(experiences).toBeTruthy();
			done();
		});
	});

	it('should return null when #getExperience is called with a null id', (done) => {
		subs.sink = service.getExperience(null).subscribe((experience) => {
			expect(experience).toBeNull();
			done();
		});
	});

	it('should find and return a value when #getExperiences is called', (done) => {
		mockDataRef.getExperiences.and.returnValue(
			of([
				{
					id: 'test1',
					title: 'Test',
					description: 'Test test test.',
				},
			]),
		);
		subs.sink = service.getExperience('test1').subscribe((experience) => {
			expect(experience).toBeTruthy();
			done();
		});
	});

	it('should return null when #getExperiences is called with a non-existent id', (done) => {
		mockDataRef.getExperiences.and.returnValue(
			of([
				{
					id: 'test1',
					title: 'Test',
					description: 'Test test test.',
				},
			]),
		);
		subs.sink = service.getExperience('test2').subscribe((experience) => {
			expect(experience).toBeNull();
			done();
		});
	});
});
