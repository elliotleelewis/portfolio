import { enableProdMode } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';

import { AppModule } from './app/app.module';
import { ENVIRONMENT } from './environments/environment';

if (ENVIRONMENT.production) {
	enableProdMode();
}

platformBrowser()
	.bootstrapModule(AppModule)
	.catch((err) => console.error(err));
