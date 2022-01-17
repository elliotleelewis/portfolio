import { NgModule } from '@angular/core';

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

		expect(
			await (route?.loadChildren as () => Promise<NgModule>)(),
		).toEqual(IndexModule);
	});

	it('should load ProjectModule', async () => {
		const route = ROUTES.find((r) => r.path === 'project');

		expect(
			await (route?.loadChildren as () => Promise<NgModule>)(),
		).toEqual(ProjectModule);
	});
});
