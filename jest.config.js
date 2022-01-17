module.exports = {
	setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
	moduleNameMapper: {
		'^@app-data/(.*)$': '<rootDir>/src/app/data/$1',
		'^@app-models/(.*)$': '<rootDir>/src/app/models/$1',
		'^@app-refs/(.*)$': '<rootDir>/src/app/refs/$1',
		'^@app-services/(.*)$': '<rootDir>/src/app/services/$1',
	},
	coverageThreshold: {
		global: {
			branches: 100,
			functions: 100,
			lines: 100,
			statements: 100,
		},
	},
};
