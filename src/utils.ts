function validate(config: any): config is { port: number, logLevel: string; accountAvailable: boolean; } {
	if (typeof config.port != "number") {
		return false;
	}

	if (typeof config.logLevel != "string" || !["none", "min", "info", "debug"].includes(config.logLevel)) {
		return false;
	}

	if (typeof config.accountAvailable != "boolean") {
		return false;
	}

	return true;
}

export function LoadConfig() {
	const config = require("../config.json");
	for (const key of Object.keys(config)) {
		if (!["port", "logLevel", "accountAvailable"].includes(key)) {
			throw new Error(`config.json contains an invalid key: ${key}`);
		}
	}
	if (!validate(config)) {
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
