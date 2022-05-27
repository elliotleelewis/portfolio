import {
	Directive,
	Inject,
	Input,
	TemplateRef,
	ViewContainerRef,
} from '@angular/core';

/**
 * Directive that re-renders component when given value changes
 */
@Directive({
	selector: '[portfolioIfChanges]',
})
export class IfChangesDirective<T> {
	private _currentValue: T | null = null;
	private _hasView = false;

	constructor(
		@Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
		@Inject(TemplateRef) private templateRef: TemplateRef<unknown>,
	) {}

	/**
	 * Re-renders component when given value is changed
	 *
	 * @param value - Value to watch
	 */
	@Input()
	set portfolioIfChanges(value: T) {
		if (!this._hasView) {
			this.viewContainerRef.createEmbeddedView(this.templateRef);
			this._hasView = true;
		} else if (value !== this._currentValue) {
			this.viewContainerRef.clear();
			this.viewContainerRef.createEmbeddedView(this.templateRef);
		}
		this._currentValue = value;
	}
}
