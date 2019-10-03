import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

/**
 * Directive that re-renders component when given value changes
 */
@Directive({
	selector: '[portfolioIfChanges]',
})
export class IfChangesDirective {
	private currentValue: any;
	private hasView = false;

	constructor(
		private viewContainerRef: ViewContainerRef,
		private templateRef: TemplateRef<any>,
	) {}

	/**
	 * Re-renders component when given value is changed
	 * @param value - Value to watch
	 */
	@Input()
	set portfolioIfChanges(value: any) {
		if (!this.hasView) {
			this.viewContainerRef.createEmbeddedView(this.templateRef);
			this.hasView = true;
		} else if (value !== this.currentValue) {
			this.viewContainerRef.clear();
			this.viewContainerRef.createEmbeddedView(this.templateRef);
			this.currentValue = value;
		}
	}
}
