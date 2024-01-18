import { getAnalytics, provideAnalytics } from '@angular/fire/analytics';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getPerformance, providePerformance } from '@angular/fire/performance';

import type { Environment } from '@app-models/environment';

export const ENVIRONMENT: Environment = {
	production: true,
	imports: [
		provideAnalytics(() => getAnalytics()),
		providePerformance(() => getPerformance()),
		provideFirebaseApp(() =>
			initializeApp({
				apiKey: process.env['FIREBASE_API_KEY'],
				authDomain: process.env['FIREBASE_AUTH_DOMAIN'],
				databaseURL: process.env['FIREBASE_DATABASE_URL'],
				projectId: process.env['FIREBASE_PROJECT_ID'],
				storageBucket: process.env['FIREBASE_STORAGE_BUCKET'],
				messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID'],
				appId: process.env['FIREBASE_APP_ID'],
				measurementId: process.env['FIREBASE_MEASUREMENT_ID'],
			}),
		),
	],
	providers: [],
};
