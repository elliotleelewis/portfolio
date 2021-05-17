import { ProjectModule } from './project.module';

describe('ProjectModule', () => {
	let module: ProjectModule;

	beforeEach(() => {
		module = new ProjectModule();
	});

	it('should create an instance', () => {
		expect(module).toBeTruthy();
	});
});
