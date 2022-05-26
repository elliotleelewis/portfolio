import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Standard page footer component
 */
@Component({
	selector: 'portfolio-footer',
	templateUrl: './footer.component.html',
	styleUrls: ['./footer.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
	/**
	 * Contact email address
	 */
	get email(): string {
		const address = 'elliotleelewis';
		const domain = 'gmail.com';
		return `${address}@${domain}`;
	}
}
