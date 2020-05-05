import { enableProdMode } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import WebFont from 'webfontloader';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
	enableProdMode();
}

platformBrowser()
	.bootstrapModule(AppModule)
	.catch((err) => console.error(err));

WebFont.load({
	google: {
		families: ['Playfair Display:700,900', '&display=swap'],
	},
});
