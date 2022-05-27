import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Standard page navbar component
 */
@Component({
	selector: 'portfolio-navbar',
	templateUrl: './navbar.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
	/**
	 * Controls open status of side menu
	 */
	menuOpen = false;
}
