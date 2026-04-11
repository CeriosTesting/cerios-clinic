const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// Root of the monorepo (two levels above apps/patient-mobile)
const monorepoRoot = path.resolve(__dirname, "../..");

const config = {
	// Watch all packages in the monorepo so Metro picks up changes to shared packages
	watchFolders: [monorepoRoot],
	resolver: {
		// Resolve workspace-root node_modules so Metro finds shared packages
		nodeModulesPaths: [path.resolve(monorepoRoot, "node_modules"), path.resolve(__dirname, "node_modules")],
	},
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
