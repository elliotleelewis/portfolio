const path = require('path');
const glob = require('glob');
const dotenvWebpack = require('dotenv-webpack');
const { PurgeCSSPlugin } = require('purgecss-webpack-plugin');

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
		new PurgeCSSPlugin({
			paths: () => glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
		}),
	);

	return cfg;
};
