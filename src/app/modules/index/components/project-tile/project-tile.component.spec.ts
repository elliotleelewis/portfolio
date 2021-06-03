import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ProjectTileComponent } from './project-tile.component';

describe('ProjectTileComponent', () => {
	let component: ProjectTileComponent;
	let fixture: ComponentFixture<ProjectTileComponent>;

	beforeEach(
		waitForAsync(() => {
			void TestBed.configureTestingModule({
				declarations: [ProjectTileComponent],
				imports: [RouterTestingModule],
			}).compileComponents();
		}),
	);

	beforeEach(() => {
		fixture = TestBed.createComponent(ProjectTileComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
