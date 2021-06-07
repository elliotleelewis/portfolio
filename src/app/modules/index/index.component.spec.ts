import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
	ComponentFixture,
	fakeAsync,
	TestBed,
	tick,
	waitForAsync,
} from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockDirective } from 'ng-mocks';
import { of } from 'rxjs';
import { take } from 'rxjs/operators';

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

			void TestBed.configureTestingModule({
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
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should cycle through each title', fakeAsync(() => {
		let title: string | undefined = '';
		const sub = component.title$
			?.pipe(take(3))
			.subscribe((t) => (title = t));

		for (let i = 0; i < component.titles.length - 1; i++) {
			tick(i === 0 ? 1 : IndexComponent.TITLE_INTERVAL);

			expect(title).toBe(component.titles[i] ?? '');
		}

		sub?.unsubscribe();
	}));
});
