import { TestBed, waitForAsync } from '@angular/core/testing';
import { of } from 'rxjs';

import { DataRef } from '@app-refs/data.ref';

import { ProjectService } from './project.service';

describe('ProjectService', () => {
	let service: ProjectService;

	let mockDataRef: jasmine.SpyObj<DataRef>;

	beforeEach(() => {
		mockDataRef = jasmine.createSpyObj<DataRef>(['getProjects']);
		mockDataRef.getProjects.and.returnValue(of([]));

		TestBed.configureTestingModule({
			providers: [{ provide: DataRef, useValue: mockDataRef }],
		});
		service = TestBed.inject(ProjectService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should #getProjects', waitForAsync(() => {
		service.getProjects().subscribe((projects) => {
			expect(projects).toBeTruthy();
		});
	}));

	it('should return null when #getProject is called with a null id', waitForAsync(() => {
		service.getProject(null).subscribe((project) => {
			expect(project).toBeNull();
		});
	}));

	it(
		'should find and return a value when #getProjects is called',
		waitForAsync(() => {
			mockDataRef.getProjects.and.returnValue(
				of([
					{
						id: 'test1',
						title: 'Test',
						description: 'Test test test.',
					},
				]),
			);
			service.getProject('test1').subscribe((project) => {
				expect(project).toBeTruthy();
			});
		}),
	);

	it(
		'should return null when #getProjects is called with a non-existent id',
		waitForAsync(() => {
			mockDataRef.getProjects.and.returnValue(
				of([
					{
						id: 'test1',
						title: 'Test',
						description: 'Test test test.',
					},
				]),
			);
			service.getProject('test2').subscribe((project) => {
				expect(project).toBeNull();
			});
		}),
	);
});
