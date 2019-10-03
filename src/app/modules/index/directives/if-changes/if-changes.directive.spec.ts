import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IfChangesDirective } from './if-changes.directive';

@Component({
	selector: 'portfolio-mock',
	template: '<div *portfolioIfChanges="s"></div>',
})
class MockComponent {
	/**
	 * Mock class property
	 */
	s: string;
}

describe('IfChangesDirective', () => {
	let component: MockComponent;
	let fixture: ComponentFixture<MockComponent>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			declarations: [MockComponent, IfChangesDirective],
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(MockComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should still exist after variable change', () => {
		component.s = 'test';
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});
});
