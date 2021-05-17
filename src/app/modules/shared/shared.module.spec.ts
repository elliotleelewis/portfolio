import { SharedModule } from './shared.module';

describe('SharedModule', () => {
	let module: SharedModule;

	beforeEach(() => {
		module = new SharedModule();
	});

	it('should create an instance', () => {
		expect(module).toBeTruthy();
	});
});
