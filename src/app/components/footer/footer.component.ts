import { Component } from '@angular/core';

@Component({
	selector: 'portfolio-footer',
	templateUrl: './footer.component.html',
	styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
	address = 'REDACTED';
	domain = 'redacted.invalid';

	get email(): string {
		return `${this.address}@${this.domain}`;
	}
}
