const path = require('path');
const glob = require('glob');
const dotenvWebpack = require('dotenv-webpack');
const purgecssWebpackPlugin = require('purgecss-webpack-plugin');

const PATHS = {
	src: path.join(__dirname, 'src'),
};

module.exports = {
	plugins: [
		new dotenvWebpack({
			systemvars: true,
		}),
		new purgecssWebpackPlugin({
			paths: () => glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
		}),
	],
};
