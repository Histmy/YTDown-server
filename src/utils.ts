export function LoadConfig() {
	const config = require("../config.json") as { port?: number, logLevel?: string; };
	for (const key of Object.keys(config)) {
		if (!["port", "logLevel"].includes(key)) {
			throw new Error(`config.json contains an invalid key: ${key}`);
		}
	}
	if (typeof config.port != "number") {
		throw new Error("config.json is invalid");
	}

	return config;
}

export const config = LoadConfig();

const logLevel = config.logLevel == "none" ? 0 : config.logLevel == "min" ? 1 : config.logLevel == "info" ? 2 : config.logLevel == "debug" ? 3 : 1;

export function log(level: number, ...loging: any) {
	if (logLevel < level)
		return;

	const date = new Date();
	const time = `[${date.getDate()}.${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}]`;
	console.log(time, ...loging);
}
