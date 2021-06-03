import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { FaceComponent } from './face.component';

describe('FaceComponent', () => {
	let component: FaceComponent;
	let fixture: ComponentFixture<FaceComponent>;

	beforeEach(
		waitForAsync(() => {
			void TestBed.configureTestingModule({
				declarations: [FaceComponent],
				imports: [NoopAnimationsModule],
			}).compileComponents();
		}),
	);

	beforeEach(() => {
		fixture = TestBed.createComponent(FaceComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('animate', () => {
		it('should increment count when called', () => {
			const prev = component.count;

			component.animate();

			expect(component.count).toBe(prev + 1);
		});
	});
});
