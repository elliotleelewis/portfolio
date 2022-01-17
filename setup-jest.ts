import 'jest-preset-angular/setup-jest';
import { ngMocks } from 'ng-mocks';

/**
 * Monkey patch console warn and error to fail if a test makes calls to console.warn or console.error.
 */
console.warn = (message?: unknown, ...optionalParams: unknown[]): void => {
	const params = optionalParams ? `\nParams: ${String(optionalParams)}` : '';
	throw new Error(
		`Test contained console warning:\n${String(message)}${params}`,
	);
};
console.error = (message?: unknown, ...optionalParams: unknown[]): void => {
	const params = optionalParams ? `\nParams: ${String(optionalParams)}` : '';
	throw new Error(
		`Test contained console error:\n${String(message)}${params}`,
	);
};

ngMocks.autoSpy('jest');
