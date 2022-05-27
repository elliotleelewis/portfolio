import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Standard page footer component
 */
@Component({
	selector: 'portfolio-footer',
	templateUrl: './footer.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
	/**
	 * Contact email address
	 */
	get email(): string {
		const address = 'REDACTED';
		const domain = 'redacted.invalid';
		return `${address}@${domain}`;
	}
}
