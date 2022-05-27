import {
	animate,
	keyframes,
	style,
	transition,
	trigger,
} from '@angular/animations';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import spring from 'css-spring';

/**
 * Animated SVG face component
 */
@Component({
	selector: 'portfolio-face',
	templateUrl: './face.component.html',
	styleUrls: ['./face.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	animations: [
		trigger('spin', [
			transition(':increment', [
				animate(
					'1536ms linear',
					keyframes(
						Object.entries(
							spring(
								{ rotate: '0deg' },
								{ rotate: '360deg' },
								{ preset: 'gentle' },
							),
						).map(([key, value]) =>
							style({
								transform: `rotate(${value.rotate})`,
								offset: parseFloat(key) / 100,
							}),
						),
					),
				),
			]),
		]),
	],
})
export class FaceComponent {
	/**
	 * Animation count
	 */
	count = 0;

	/**
	 * Triggers glasses animation
	 */
	animate(): void {
		this.count++;
	}
}
