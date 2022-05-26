import { TestBed } from '@angular/core/testing';
import type { ParamMap } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import type { MockedComponentFixture } from 'ng-mocks';
import { MockBuilder, MockRender } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';
import { SubSink } from 'subsink';

import type { Project } from '@app-models/project';
import { ProjectService } from '@app-services/project/project.service';

import { ProjectComponent } from './project.component';
import { ProjectModule } from './project.module';

describe('ProjectComponent', () => {
	let component: ProjectComponent;
	let fixture: MockedComponentFixture<ProjectComponent>;

	const mockGetProject = new BehaviorSubject<Project | null>(null);
	const mockParamMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));

	const subs = new SubSink();

	beforeEach(() =>
		MockBuilder(ProjectComponent, ProjectModule)
			.mock(ActivatedRoute, {
				paramMap: mockParamMap.asObservable(),
			})
			.mock(ProjectService, {
				getProject: jest.fn(() => mockGetProject.asObservable()),
			}),
	);

	beforeEach(() => {
		fixture = MockRender(ProjectComponent);
		component = fixture.point.componentInstance;
		fixture.detectChanges();
	});

	afterEach(() => {
		subs.unsubscribe();
	});

	afterAll(() => {
		mockGetProject.complete();
		mockParamMap.complete();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should get a project', (done) => {
		const expectedProject = {
			id: 'test',
			title: 'Test',
			description: 'Test test test.',
		};
		mockGetProject.next(expectedProject);

		subs.sink = component.project$.subscribe((project) => {
			expect(project).toEqual(expectedProject);
			done();
		});
	});

	it('should get project with id from url params', (done) => {
		const projectService = TestBed.inject(ProjectService);

		mockParamMap.next(
			convertToParamMap({
				id: '123',
			}),
		);

		subs.sink = component.project$.subscribe(() => {
			expect(projectService.getProject).toHaveBeenCalledWith('123');
			done();
		});
	});
});
