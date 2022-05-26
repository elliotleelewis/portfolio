import type { TemplateRef } from '@angular/core';
import { EmbeddedViewRef, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MockService } from 'ng-mocks';

import { IfChangesDirective } from './if-changes.directive';

describe('IfChangesDirective', () => {
	let directive: IfChangesDirective<string>;

	let mockViewContainerRef: ViewContainerRef;

	beforeEach(() => {
		void TestBed.configureTestingModule({
			declarations: [IfChangesDirective],
		}).compileComponents();
	});

	beforeEach(() => {
		mockViewContainerRef = MockService(ViewContainerRef, {
			clear: jest.fn(),
			createEmbeddedView: jest.fn(() => MockService(EmbeddedViewRef)),
		});

		directive = new IfChangesDirective<string>(
			mockViewContainerRef,
			{} as TemplateRef<unknown>,
		);
	});

	it('should create', () => {
		expect(directive).toBeTruthy();
	});

	it('should create embedded view on initial load', () => {
		directive.portfolioIfChanges = 'test1';

		expect(mockViewContainerRef.createEmbeddedView).toHaveBeenCalledTimes(
			1,
		);

		expect(mockViewContainerRef.clear).not.toHaveBeenCalled();
	});

	it('should re-create embedded view on subsequent changes', () => {
		directive.portfolioIfChanges = 'test1';
		directive.portfolioIfChanges = 'test2';

		expect(mockViewContainerRef.createEmbeddedView).toHaveBeenCalledTimes(
			2,
		);

		expect(mockViewContainerRef.clear).toHaveBeenCalledTimes(1);
	});

	it("shouldn't re-create embedded view if value doesn't change", () => {
		directive.portfolioIfChanges = 'test1';
		directive.portfolioIfChanges = 'test1';

		expect(mockViewContainerRef.createEmbeddedView).toHaveBeenCalledTimes(
			1,
		);

		expect(mockViewContainerRef.clear).not.toHaveBeenCalled();
	});
});
