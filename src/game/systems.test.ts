import { describe, expect, it } from 'vitest';

import { Systems } from './systems';

describe('Systems', () => {
	it('runs systems by order, then in the order they were added', () => {
		const systems = new Systems();
		const ran: string[] = [];
		for (const [order, name] of [
			[20, 'b'],
			[10, 'a'],
			[20, 'c'],
		] as const) {
			systems.add(order, () => {
				ran.push(name);
			});
		}
		systems.run(1 / 60);
		expect(ran).toEqual(['a', 'b', 'c']);
	});

	it('passes each system the step', () => {
		const systems = new Systems();
		let seen = 0;
		systems.add(10, (dt) => {
			seen = dt;
		});
		systems.run(0.25);
		expect(seen).toBe(0.25);
	});

	it('stops running a system once removed', () => {
		const systems = new Systems();
		let runs = 0;
		const remove = systems.add(10, () => {
			runs++;
		});
		systems.run(1 / 60);
		remove();
		systems.run(1 / 60);
		expect(runs).toBe(1);
	});
});
