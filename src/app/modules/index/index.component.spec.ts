import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockDirective } from 'ng-mocks';
import { of } from 'rxjs';

import { EducationService } from '@app-services/education/education.service';
import { ExperienceService } from '@app-services/experience/experience.service';
import { ProjectService } from '@app-services/project/project.service';

import { IfChangesDirective } from '../shared/directives/if-changes/if-changes.directive';

import { IndexComponent } from './index.component';

describe('IndexComponent', () => {
	let component: IndexComponent;
	let fixture: ComponentFixture<IndexComponent>;
	let mockEducationService: jasmine.SpyObj<EducationService>;
	let mockExperienceService: jasmine.SpyObj<ExperienceService>;
	let mockProjectService: jasmine.SpyObj<ProjectService>;

	beforeEach(
		waitForAsync(() => {
			mockEducationService = jasmine.createSpyObj<EducationService>([
				'getEducations',
			]);
			mockEducationService.getEducations.and.returnValue(of([]));
			mockExperienceService = jasmine.createSpyObj<ExperienceService>([
				'getExperiences',
			]);
			mockExperienceService.getExperiences.and.returnValue(of([]));
			mockProjectService = jasmine.createSpyObj<ProjectService>([
				'getProjects',
			]);
			mockProjectService.getProjects.and.returnValue(of([]));

			TestBed.configureTestingModule({
				declarations: [
					IndexComponent,
					MockDirective(IfChangesDirective),
				],
				imports: [NoopAnimationsModule],
				providers: [
					{
						provide: EducationService,
						useValue: mockEducationService,
					},
					{
						provide: ExperienceService,
						useValue: mockExperienceService,
					},
					{ provide: ProjectService, useValue: mockProjectService },
				],
				schemas: [CUSTOM_ELEMENTS_SCHEMA],
			}).compileComponents();
		}),
	);

	beforeEach(() => {
		fixture = TestBed.createComponent(IndexComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		jasmine.clock().install();
	});

	afterEach(() => {
		jasmine.clock().uninstall();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should cycle through each title', () => {
		fixture.whenStable().then(() => {
			for (let i = 0; i < component.titles.length * 10; i++) {
				jasmine.clock().tick(2049);
				fixture.detectChanges();
				const index = i % component.titles.length;
				expect(component.titleIndex).toEqual(
					index + 2 > component.titles.length ? 0 : index + 1,
				);
			}
		});
	});
});
