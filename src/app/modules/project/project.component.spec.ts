import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { ProjectService } from '@app-services/project/project.service';

import { ProjectComponent } from './project.component';

describe('ProjectComponent', () => {
	let component: ProjectComponent;
	let fixture: ComponentFixture<ProjectComponent>;
	let mockProjectService: jasmine.SpyObj<ProjectService>;

	beforeEach(async(() => {
		mockProjectService = jasmine.createSpyObj<ProjectService>([
			'getProjects',
		]);
		mockProjectService.getProjects.and.returnValue(of([]));

		TestBed.configureTestingModule({
			declarations: [ProjectComponent],
			imports: [RouterTestingModule],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ProjectComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
