import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ProjectTileComponent } from './project-tile.component';

describe('ProjectComponent', () => {
	let component: ProjectTileComponent;
	let fixture: ComponentFixture<ProjectTileComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ProjectTileComponent],
			imports: [RouterTestingModule],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ProjectTileComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
