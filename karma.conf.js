// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
	config.set({
		basePath: '',
		frameworks: ['jasmine', '@angular-devkit/build-angular'],
		plugins: [
			require('karma-jasmine'),
			require('karma-chrome-launcher'),
			require('karma-jasmine-html-reporter'),
			require('karma-junit-reporter'),
			require('karma-coverage'),
			require('@angular-devkit/build-angular/plugins/karma'),
		],
		client: {
			clearContext: false, // leave Jasmine Spec Runner output visible in browser
		},
		junitReporter: {
			outputDir: './reports',
			outputFile: 'karma.xml',
			useBrowserName: false,
		},
		coverageReporter: {
			dir: './reports/coverage',
			subdir: '.',
			includeAllSources: true,
			reporters: [
				{ type: 'cobertura' },
				{ type: 'lcovonly' },
				{ type: 'html' },
				{ type: 'text' },
			],
			check: {
				// thresholds for all files
				global: {
					statements: 100,
					branches: 100,
					functions: 100,
					lines: 100,
				},
				// thresholds per file
				each: {
					statements: 100,
					branches: 100,
					functions: 100,
					lines: 100,
				},
			},
		},
		reporters: ['progress', 'kjhtml', 'junit', 'coverage'],
		port: 9876,
		colors: true,
		logLevel: config.LOG_INFO,
		autoWatch: true,
		browsers: ['ChromeHeadless'],
		singleRun: false,
		restartOnFileChange: true,
	});
};
