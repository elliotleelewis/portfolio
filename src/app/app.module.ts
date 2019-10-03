import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PreloadAllModules, RouterModule } from '@angular/router';
import { ServiceWorkerModule } from '@angular/service-worker';
import { ScrollToModule } from '@nicky-lenaers/ngx-scroll-to';

import { environment } from '../environments/environment';

import { AppComponent } from './app.component';
import { FooterComponent } from './components/footer/footer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SharedModule } from './modules/shared/shared.module';

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
		BrowserModule,
		BrowserAnimationsModule,
		HttpClientModule,
		RouterModule.forRoot(
			[
				{
					path: '',
					pathMatch: 'full',
					loadChildren: () =>
						import('./modules/index/index.module').then(
							(m) => m.IndexModule,
						),
				},
				{
					path: 'project',
					loadChildren: () =>
						import('./modules/project/project.module').then(
							(m) => m.ProjectModule,
						),
				},
			],
			{
				useHash: true,
				preloadingStrategy: PreloadAllModules,
			},
		),
		ServiceWorkerModule.register('ngsw-worker.js', {
			enabled: environment.production,
		}),
		// External Modules
		ScrollToModule.forRoot(),
		// Application Modules
		SharedModule,
	],
	providers: [],
	bootstrap: [AppComponent],
})
export class AppModule {}
