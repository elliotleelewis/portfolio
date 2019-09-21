import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ScrollToModule } from '@nicky-lenaers/ngx-scroll-to';

import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
	let component: NavbarComponent;
	let fixture: ComponentFixture<NavbarComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
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
