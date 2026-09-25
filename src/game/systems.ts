export type SystemUpdate = (dt: number) => void;

// The order systems run in on each step of the game.
export const SYSTEM_ORDER = {
	// Me: the intro, then rolling, steering and hitting trees.
	character: 10,
	trees: 20,
	bears: 30,
	easterEggs: 40,
	// Debris, flying shards and the smash's blast.
	effects: 50,
	camera: 60,
	// Pieces of the world that follow me or the camera.
	follow: 70,
} as const;

interface Entry {
	order: number;
	update: SystemUpdate;
}

/**
 * The parts of the game that move on each step, run in a fixed order so each
 * sees the others' latest state (e.g. the camera after I've moved).
 */
export class Systems {
	private _entries: Entry[] = [];

	/**
	 * Adds a system. Systems with the same order run in the order added.
	 * @param order - When to run, from {@link SYSTEM_ORDER}.
	 * @param update - What to run each step.
	 * @returns A function that removes the system again.
	 */
	public add(order: number, update: SystemUpdate): () => void {
		const entry = { order, update };
		const index = this._entries.findIndex((other) => other.order > order);
		if (index === -1) {
			this._entries.push(entry);
		} else {
			this._entries.splice(index, 0, entry);
		}
		return () => {
			this._entries = this._entries.filter((other) => other !== entry);
		};
	}

	/**
	 * Runs every system once, in order.
	 * @param dt - Seconds since the last step.
	 */
	public run(dt: number): void {
		for (const { update } of this._entries) {
			update(dt);
		}
	}
}
