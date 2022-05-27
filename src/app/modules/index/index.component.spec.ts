import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockDirective, MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { take } from 'rxjs/operators';
import { SubSink } from 'subsink';

import { EducationService } from '@app-services/education/education.service';
import { ExperienceService } from '@app-services/experience/experience.service';
import { ProjectService } from '@app-services/project/project.service';

import { IfChangesDirective } from '../shared/directives/if-changes/if-changes.directive';

import { IndexComponent } from './index.component';

describe('IndexComponent', () => {
	let component: IndexComponent;
	let fixture: ComponentFixture<IndexComponent>;

	const subs = new SubSink();

	beforeEach(waitForAsync(() => {
		void TestBed.configureTestingModule({
			declarations: [IndexComponent, MockDirective(IfChangesDirective)],
			imports: [NoopAnimationsModule],
			providers: [
				MockProvider(EducationService, {
					getEducations: () => of([]),
				}),
				MockProvider(ExperienceService, {
					getExperiences: () => of([]),
				}),
				MockProvider(ProjectService, {
					getProjects: () => of([]),
				}),
			],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(IndexComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	afterEach(() => {
		subs.unsubscribe();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should cycle through each title', fakeAsync(() => {
		let title: string | undefined = '';
		subs.sink = component.title$
			?.pipe(take(3))
			.subscribe((t) => (title = t));

		for (let i = 0; i < component.titles.length - 1; i++) {
			tick(i === 0 ? 1 : IndexComponent.TITLE_INTERVAL);

			expect(title).toBe(component.titles[i] ?? '');
		}
	}));
});
