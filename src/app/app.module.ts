import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import type { Routes } from '@angular/router';
import { PreloadAllModules, RouterModule } from '@angular/router';
import { ServiceWorkerModule } from '@angular/service-worker';
import { ScrollToModule } from '@nicky-lenaers/ngx-scroll-to';

import { ENVIRONMENT } from '../environments/environment';

import { AppComponent } from './app.component';
import { FooterComponent } from './components/footer/footer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SharedModule } from './modules/shared/shared.module';

export const ROUTES: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadChildren: () =>
			import('./modules/index/index.module').then((m) => m.IndexModule),
	},
	{
		path: 'project',
		loadChildren: () =>
			import('./modules/project/project.module').then(
				(m) => m.ProjectModule,
			),
	},
];

/**
 * Root application module
 */
@NgModule({
	declarations: [
		AppComponent,
		// Components
		FooterComponent,
		NavbarComponent,
	],
	imports: [
		// Angular Modules
		BrowserAnimationsModule,
		HttpClientModule,
		RouterModule.forRoot(ROUTES, {
			useHash: true,
			preloadingStrategy: PreloadAllModules,
		}),
		ServiceWorkerModule.register('ngsw-worker.js', {
			enabled: ENVIRONMENT.production,
		}),
		// External Modules
		ScrollToModule.forRoot(),
		// Application Modules
		SharedModule,
		// Environment Modules
		...(ENVIRONMENT.imports || []),
	],
	providers: [
		// Environment Providers
		...(ENVIRONMENT.providers || []),
	],
	bootstrap: [AppComponent],
})
export class AppModule {}
