import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

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

	@Input()
	set portfolioIfChanges(val: any) {
		if (!this.hasView) {
			this.viewContainerRef.createEmbeddedView(this.templateRef);
			this.hasView = true;
		} else if (val !== this.currentValue) {
			this.viewContainerRef.clear();
			this.viewContainerRef.createEmbeddedView(this.templateRef);
			this.currentValue = val;
		}
	}
}
