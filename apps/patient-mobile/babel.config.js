module.exports = {
	presets: ["module:@react-native/babel-preset"],
	plugins: [
		[
			"module:react-native-dotenv",
			{
				moduleName: "@env",
				path: ".env",
				safe: false,
				allowUndefined: false,
			},
		],
		// react-native-reanimated plugin MUST be last
		"react-native-reanimated/plugin",
	],
};
