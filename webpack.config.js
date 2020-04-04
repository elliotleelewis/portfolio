const dotenvWebpack = require('dotenv-webpack');

module.exports = {
	plugins: [
		new dotenvWebpack({
			systemvars: true,
		}),
	],
};
