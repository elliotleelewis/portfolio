import { AppModule, ROUTES } from './app.module';
import { IndexModule } from './modules/index/index.module';
import { ProjectModule } from './modules/project/project.module';

describe('AppModule', () => {
	let module: AppModule;

	beforeEach(() => {
		module = new AppModule();
	});

	it('should create an instance', () => {
		expect(module).toBeTruthy();
	});

	it('should load IndexModule', async () => {
		const route = ROUTES.find((r) => r.path === '');

		if (typeof route?.loadChildren === 'function') {
			expect(await route.loadChildren()).toEqual(IndexModule);
		}
	});

	it('should load ProjectModule', async () => {
		const route = ROUTES.find((r) => r.path === 'project');

		if (typeof route?.loadChildren === 'function') {
			expect(await route.loadChildren()).toEqual(ProjectModule);
		}
	});
});
