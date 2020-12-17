const path = require('path');
const glob = require('glob');
const dotenvWebpack = require('dotenv-webpack');
const purgecssWebpackPlugin = require('purgecss-webpack-plugin');

const PATHS = {
	src: path.join(__dirname, 'src'),
};

module.exports = (cfg) => {
	cfg.plugins.push(
		new dotenvWebpack({
			systemvars: true,
		}),
	);
	cfg.plugins.push(
		new purgecssWebpackPlugin({
			paths: () => glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
		}),
	);

	return cfg;
};
