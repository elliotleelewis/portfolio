import { CUSTOM_ELEMENTS_SCHEMA, Directive, Input } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { IndexComponent } from './index.component';

@Directive({
	selector: '[portfolioIfChanges]',
})
class MockPortfolioIfChangesDirective {
	/**
	 * Mock class method
	 * @param v - Value
	 */
	@Input()
	set portfolioIfChanges(v: any) {
		//
	}
}

describe('IndexComponent', () => {
	let component: IndexComponent;
	let fixture: ComponentFixture<IndexComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [IndexComponent, MockPortfolioIfChangesDirective],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(IndexComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		jasmine.clock().install();
	});

	afterEach(() => {
		jasmine.clock().uninstall();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should cycle through each title', () => {
		fixture.whenStable().then(() => {
			for (let i = 0; i < component.titles.length * 10; i++) {
				jasmine.clock().tick(2049);
				fixture.detectChanges();
				const index = i % component.titles.length;
				expect(component.titleIndex).toEqual(
					index + 2 > component.titles.length ? 0 : index + 1,
				);
			}
		});
	});
});
