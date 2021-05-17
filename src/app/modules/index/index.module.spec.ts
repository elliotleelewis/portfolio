import { IndexModule } from './index.module';

describe('IndexModule', () => {
	let module: IndexModule;

	beforeEach(() => {
		module = new IndexModule();
	});

	it('should create an instance', () => {
		expect(module).toBeTruthy();
	});
});
