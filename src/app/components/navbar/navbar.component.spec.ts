import type { ComponentFixture } from '@angular/core/testing';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NgxPageScrollModule } from 'ngx-page-scroll';
import { NgxPageScrollCoreModule } from 'ngx-page-scroll-core';

import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
	let component: NavbarComponent;
	let fixture: ComponentFixture<NavbarComponent>;

	beforeEach(waitForAsync(() => {
		void TestBed.configureTestingModule({
			declarations: [NavbarComponent],
			imports: [
				RouterTestingModule,
				NgxPageScrollCoreModule.forRoot(),
				NgxPageScrollModule,
			],
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
