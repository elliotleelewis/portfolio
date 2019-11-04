import {
	animate,
	keyframes,
	style,
	transition,
	trigger,
} from '@angular/animations';
import { Component } from '@angular/core';
import spring from 'css-spring';

@Component({
	selector: 'portfolio-face',
	templateUrl: './face.component.html',
	styleUrls: ['./face.component.scss'],
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
						).map(
							([key, value]: [
								string,
								{ [key: string]: string },
							]) =>
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
	count = 0;
}
