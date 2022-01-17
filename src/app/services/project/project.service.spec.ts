import { TestBed } from '@angular/core/testing';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';
import { SubSink } from 'subsink';

import { Project } from '@app-models/project';
import { DataRef } from '@app-refs/data.ref';

import { ProjectService } from './project.service';

describe('ProjectService', () => {
	let service: ProjectService;

	const subs = new SubSink();

	const mockGetProjects = new BehaviorSubject<Project[]>([]);

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				MockProvider(DataRef, {
					getProjects: () => mockGetProjects.asObservable(),
				}),
			],
		});
		service = TestBed.inject(ProjectService);
	});

	afterEach(() => {
		subs.unsubscribe();
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should #getProjects', (done) => {
		subs.sink = service.getProjects().subscribe((projects) => {
			expect(projects).toBeTruthy();
			done();
		});
	});

	it('should return null when #getProject is called with a null id', (done) => {
		subs.sink = service.getProject(null).subscribe((project) => {
			expect(project).toBeNull();
			done();
		});
	});

	it('should find and return a value when #getProjects is called', (done) => {
		mockGetProjects.next([
			{
				id: 'test1',
				title: 'Test',
				description: 'Test test test.',
			},
		]);

		subs.sink = service.getProject('test1').subscribe((project) => {
			expect(project).toBeTruthy();
			done();
		});
	});

	it('should return null when #getProjects is called with a non-existent id', (done) => {
		mockGetProjects.next([
			{
				id: 'test1',
				title: 'Test',
				description: 'Test test test.',
			},
		]);

		subs.sink = service.getProject('test2').subscribe((project) => {
			expect(project).toBeNull();
			done();
		});
	});
});
