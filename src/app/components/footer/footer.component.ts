import { Component } from '@angular/core';

@Component({
	selector: 'portfolio-footer',
	templateUrl: './footer.component.html',
	styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
	address = 'elliotleelewis';
	domain = 'gmail.com';

	get email(): string {
		return `${this.address}@${this.domain}`;
	}
}
