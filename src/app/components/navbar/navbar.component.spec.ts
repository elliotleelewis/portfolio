import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ScrollToModule } from '@nicky-lenaers/ngx-scroll-to';

import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
	let component: NavbarComponent;
	let fixture: ComponentFixture<NavbarComponent>;

	beforeEach(waitForAsync(() => {
		void TestBed.configureTestingModule({
			declarations: [NavbarComponent],
			imports: [RouterTestingModule, ScrollToModule.forRoot()],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(NavbarComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
