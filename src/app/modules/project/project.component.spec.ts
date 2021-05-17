import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { ProjectService } from '@app-services/project/project.service';

import { ProjectComponent } from './project.component';

describe('ProjectComponent', () => {
	let component: ProjectComponent;
	let fixture: ComponentFixture<ProjectComponent>;
	let mockProjectService: jasmine.SpyObj<ProjectService>;

	beforeEach(
		waitForAsync(() => {
			mockProjectService = jasmine.createSpyObj<ProjectService>([
				'getProject',
			]);
			mockProjectService.getProject.and.returnValue(of(null));

			TestBed.configureTestingModule({
				declarations: [ProjectComponent],
				imports: [RouterTestingModule],
				providers: [
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

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
