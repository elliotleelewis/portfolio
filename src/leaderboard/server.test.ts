import { describe, expect, it, vi } from 'vitest';

import { BOARD_SIZE, type Entry, TURNSTILE_ACTION } from './board';
import {
	DAILY_WRITE_LIMIT,
	type Database,
	type Statement,
	getScores,
	isHuman,
	postScores,
} from './server';

interface Row {
	version: number;
	day: string;
	writes: number;
	entries: string;
}

/**
 * A stand-in for D1 that understands the two queries the API makes, and
 * counts rows read and written the way D1 bills them.
 */
class FakeDatabase implements Database {
	public row: Row | undefined = {
		version: 0,
		day: '',
		writes: 0,
		entries: '[]',
	};
	public rowsRead = 0;
	public rowsWritten = 0;
	// Runs just before an update, to let another score land first.
	public beforeUpdate: (() => void) | undefined;

	private update([entries, day, version, limit]: unknown[]): number {
		const row = this.row;
		if (!row) {
			return 0;
		}
		this.rowsRead++;
		if (
			row.version !== version ||
			(row.day === day && row.writes >= Number(limit))
		) {
			return 0;
		}
		this.row = {
			entries: String(entries),
			version: row.version + 1,
			writes: row.day === day ? row.writes + 1 : 1,
			day: String(day),
		};
		this.rowsWritten++;
		return 1;
	}

	public prepare(query: string): Statement {
		let values: unknown[] = [];
		const statement: Statement = {
			bind: (...bound) => {
				values = bound;
				return statement;
			},
			first: async () => {
				await Promise.resolve();
				expect(query).toMatch(/^SELECT/);
				if (!this.row) {
					return null;
				}
				this.rowsRead++;
				return { ...this.row };
			},
			run: async () => {
				await Promise.resolve();
				expect(query).toMatch(/^UPDATE/);
				this.beforeUpdate?.();
				this.beforeUpdate = undefined;
				return { meta: { changes: this.update(values) } };
			},
		};
		return statement;
	}

	public get entries(): unknown {
		const entries: unknown = JSON.parse(this.row?.entries ?? '[]');
		return entries;
	}
}

const now = new Date('2026-10-05T12:00:00Z');

const submission = (
	initials = 'ELL',
	trees = 40,
): Record<string, number | string> => ({
	initials,
	trees,
	metres: 600,
	seconds: 60,
	token: 'token',
});

const fullBoard: Entry[] = Array.from({ length: BOARD_SIZE }, () => ({
	initials: 'AAA',
	trees: 100,
	metres: 900,
}));

interface Answer {
	status: number;
	body: unknown;
}

const answer = async (pending: Promise<Response>): Promise<Answer> => {
	const response = await pending;
	const body: unknown = await response.json();
	return { status: response.status, body };
};

const setUp = (): {
	db: FakeDatabase;
	verify: ReturnType<typeof vi.fn<(token: string) => Promise<boolean>>>;
	send: (body: unknown) => Promise<Answer>;
} => {
	const db = new FakeDatabase();
	const verify = vi.fn<(token: string) => Promise<boolean>>(async () => {
		await Promise.resolve();
		return true;
	});
	const send = async (body: unknown): Promise<Answer> => {
		const request = new Request('https://example.com/api/scores', {
			method: 'POST',
			body: typeof body === 'string' ? body : JSON.stringify(body),
		});
		return answer(
			postScores(request, { leaderboard: db }, { verify, now }),
		);
	};
	return { db, verify, send };
};

const answering = (body: unknown): typeof fetch =>
	vi.fn(async () => {
		await Promise.resolve();
		return Response.json(body);
	});

describe('getScores', () => {
	it('answers with the board, in one row read', async () => {
		const { db } = setUp();
		db.row = {
			version: 1,
			day: '',
			writes: 0,
			entries: JSON.stringify([
				{ initials: 'ELL', trees: 9, metres: 90 },
			]),
		};
		const { body } = await answer(getScores({ leaderboard: db }));
		expect(body).toEqual({
			entries: [{ initials: 'ELL', trees: 9, metres: 90 }],
		});
		expect(db.rowsRead).toBe(1);
	});

	it('is unavailable without a database', async () => {
		const { status } = await answer(getScores({}));
		expect(status).toBe(503);
	});
});

describe('postScores', () => {
	it('puts a score on the board, in one row write', async () => {
		const { db, verify, send } = setUp();
		const { body } = await send(submission());
		expect(body).toEqual({
			entries: [{ initials: 'ELL', trees: 40, metres: 600 }],
			place: 1,
		});
		expect(db.entries).toEqual([
			{ initials: 'ELL', trees: 40, metres: 600 },
		]);
		expect(db.rowsWritten).toBe(1);
		expect(verify).toHaveBeenCalledWith('token');
	});

	it('keeps only the top of the board', async () => {
		const { db, send } = setUp();
		for (let i = 1; i <= BOARD_SIZE + 2; i++) {
			await send(submission('AAA', i));
		}
		expect(db.entries).toHaveLength(BOARD_SIZE);
	});

	it('turns down anything that is not a submission, without the database', async () => {
		const { db, verify, send } = setUp();
		for (const body of [
			'not json',
			{},
			{ ...submission(), initials: 'el' },
			{ ...submission(), token: '' },
			{ ...submission(), trees: '40' },
		]) {
			const { status } = await send(body);
			expect(status).toBe(400);
		}
		expect(db.rowsRead).toBe(0);
		expect(verify).not.toHaveBeenCalled();
	});

	it('turns down a body too big to be a submission', async () => {
		const { db, send } = setUp();
		const body = { ...submission(), padding: 'x'.repeat(4096) };
		const { status } = await send(body);
		expect(status).toBe(400);
		expect(db.rowsRead).toBe(0);
	});

	it('turns down rude initials', async () => {
		const { send } = setUp();
		const { status } = await send(submission('A55'));
		expect(status).toBe(400);
	});

	it('turns down a run real play could not reach', async () => {
		const { send } = setUp();
		const body = { ...submission(), metres: 50_000 };
		const { status } = await send(body);
		expect(status).toBe(400);
	});

	it('turns down a score that fails the check for a person', async () => {
		const { db, verify, send } = setUp();
		verify.mockResolvedValue(false);
		const { status } = await send(submission());
		expect(status).toBe(403);
		expect(db.rowsWritten).toBe(0);
	});

	it('answers with the board, without writing, when the score misses out', async () => {
		const { db, verify, send } = setUp();
		db.row = {
			version: 3,
			day: '',
			writes: 0,
			entries: JSON.stringify(fullBoard),
		};
		const { body } = await send(submission());
		expect(body).toEqual({
			entries: fullBoard,
		});
		expect(db.rowsWritten).toBe(0);
		// No need to spend the token on a score that won't be saved.
		expect(verify).not.toHaveBeenCalled();
	});

	it('keeps both scores when another lands first', async () => {
		const { db, verify, send } = setUp();
		db.beforeUpdate = () => {
			db.row = {
				version: 1,
				day: '2026-10-05',
				writes: 1,
				entries: JSON.stringify([
					{ initials: 'BOB', trees: 50, metres: 700 },
				]),
			};
		};
		const { body } = await send(submission());
		expect(body).toMatchObject({ place: 2 });
		expect(db.entries).toEqual([
			{ initials: 'BOB', trees: 50, metres: 700 },
			{ initials: 'ELL', trees: 40, metres: 600 },
		]);
		// Tokens are single use.
		expect(verify).toHaveBeenCalledOnce();
	});

	it('stops taking scores once the day has had its writes', async () => {
		const { db, send } = setUp();
		db.row = {
			version: 7,
			day: '2026-10-05',
			writes: DAILY_WRITE_LIMIT,
			entries: '[]',
		};
		const { status, body } = await send(submission());
		expect(body).toEqual({ error: 'closed' });
		expect(status).toBe(503);
		expect(db.rowsWritten).toBe(0);
	});

	it('starts counting again the next day', async () => {
		const { db, send } = setUp();
		db.row = {
			version: 7,
			day: '2026-10-04',
			writes: DAILY_WRITE_LIMIT,
			entries: '[]',
		};
		const { status } = await send(submission());
		expect(status).toBe(200);
		expect(db.row).toMatchObject({ day: '2026-10-05', writes: 1 });
	});

	it('takes scores up to the day’s limit, and no more', async () => {
		const { db, send } = setUp();
		db.row = {
			version: 0,
			day: '2026-10-05',
			writes: DAILY_WRITE_LIMIT - 2,
			entries: '[]',
		};
		const statuses: number[] = [];
		for (let i = 1; i <= 4; i++) {
			const { status } = await send(submission('AAA', i));
			statuses.push(status);
		}
		expect(statuses).toEqual([200, 200, 503, 503]);
		expect(db.row.writes).toBe(DAILY_WRITE_LIMIT);
	});

	it('never writes past the day’s limit, however many try at once', async () => {
		const { db, send } = setUp();
		db.row = {
			version: 0,
			day: '2026-10-05',
			writes: DAILY_WRITE_LIMIT - 5,
			entries: '[]',
		};
		await Promise.all(
			Array.from({ length: 50 }, async (_, i) =>
				send(submission('AAA', i + 1)),
			),
		);
		// Some give up as busy, after too many others land first.
		expect(db.row.writes).toBeLessThanOrEqual(DAILY_WRITE_LIMIT);
		expect(db.rowsWritten).toBeLessThanOrEqual(5);
		expect(db.rowsWritten).toBeGreaterThan(0);
	});

	it('reads only a handful of rows, whatever happens', async () => {
		const { db, send } = setUp();
		await Promise.all(
			Array.from({ length: 20 }, async (_, i) =>
				send(submission('AAA', i + 1)),
			),
		);
		// Up to three tries, each a read and a conditional update.
		expect(db.rowsRead).toBeLessThanOrEqual(20 * 3 * 2);
	});

	it('is unavailable before the board is set up', async () => {
		const { db, send } = setUp();
		db.row = undefined;
		const { status } = await send(submission());
		expect(status).toBe(503);
	});
});

describe('isHuman', () => {
	it('passes a good token made for saving a score', async () => {
		const fetcher = answering({ success: true, action: TURNSTILE_ACTION });
		expect(await isHuman('secret', 'token', fetcher)).toBe(true);
	});

	it('fails a bad token, or one made for something else', async () => {
		expect(
			await isHuman('secret', 'token', answering({ success: false })),
		).toBe(false);
		expect(
			await isHuman(
				'secret',
				'token',
				answering({ success: true, action: 'login' }),
			),
		).toBe(false);
	});

	it('fails when Turnstile cannot be reached', async () => {
		const fetcher = vi.fn(async () => {
			await Promise.resolve();
			throw new Error('offline');
		});
		expect(await isHuman('secret', 'token', fetcher)).toBe(false);
	});
});
