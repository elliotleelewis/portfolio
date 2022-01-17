import { TestBed } from '@angular/core/testing';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';
import { SubSink } from 'subsink';

import { Experience } from '@app-models/experience';
import { DataRef } from '@app-refs/data.ref';

import { ExperienceService } from './experience.service';

describe('ExperienceService', () => {
	let service: ExperienceService;

	const subs = new SubSink();

	const mockGetExperiences = new BehaviorSubject<Experience[]>([]);

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				MockProvider(DataRef, {
					getExperiences: () => mockGetExperiences.asObservable(),
				}),
			],
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
		mockGetExperiences.next([
			{
				id: 'test1',
				title: 'Test',
				description: 'Test test test.',
			},
		]);

		subs.sink = service.getExperience('test1').subscribe((experience) => {
			expect(experience).toBeTruthy();
			done();
		});
	});

	it('should return null when #getExperiences is called with a non-existent id', (done) => {
		mockGetExperiences.next([
			{
				id: 'test1',
				title: 'Test',
				description: 'Test test test.',
			},
		]);

		subs.sink = service.getExperience('test2').subscribe((experience) => {
			expect(experience).toBeNull();
			done();
		});
	});
});
