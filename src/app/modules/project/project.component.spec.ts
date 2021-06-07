import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { SubSink } from 'subsink';

import { ProjectService } from '@app-services/project/project.service';

import { ProjectComponent } from './project.component';

describe('ProjectComponent', () => {
	let component: ProjectComponent;
	let fixture: ComponentFixture<ProjectComponent>;

	let mockParamMap: jasmine.SpyObj<ParamMap>;
	let mockProjectService: jasmine.SpyObj<ProjectService>;

	const subs = new SubSink();

	beforeEach(
		waitForAsync(() => {
			mockParamMap = jasmine.createSpyObj<ParamMap>(['get']);
			mockParamMap.get.and.returnValue(null);
			mockProjectService = jasmine.createSpyObj<ProjectService>([
				'getProject',
			]);
			mockProjectService.getProject.and.returnValue(of(null));

			void TestBed.configureTestingModule({
				declarations: [ProjectComponent],
				imports: [RouterTestingModule],
				providers: [
					{
						provide: ActivatedRoute,
						useValue: jasmine.createSpyObj<ActivatedRoute>([], {
							paramMap: of(mockParamMap),
						}),
					},
					{ provide: ProjectService, useValue: mockProjectService },
				],
			}).compileComponents();
		}),
	);

	beforeEach(() => {
		fixture = TestBed.createComponent(ProjectComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	afterEach(() => {
		subs.unsubscribe();
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
		mockProjectService.getProject.and.returnValue(of(expectedProject));

		subs.sink = component.project$.subscribe((project) => {
			expect(project).toEqual(expectedProject);
			done();
		});
	});

	it('should get project with id from url params', (done) => {
		mockParamMap.get.and.returnValue('123');

		subs.sink = component.project$.subscribe(() => {
			expect(mockProjectService.getProject).toHaveBeenCalledOnceWith(
				'123',
			);
			done();
		});
	});
});
