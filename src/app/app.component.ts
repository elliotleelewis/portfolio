import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Root application component
 */
@Component({
	selector: 'portfolio-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
