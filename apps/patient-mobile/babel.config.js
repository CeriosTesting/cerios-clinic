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
		// react-native-worklets/reanimated plugin MUST be last
		"react-native-worklets/plugin",
	],
};
