import { configDotenv } from "dotenv";

function validate(config: any): asserts config is { port: number, logLevel: string; cookiesFile: string; accountAvailable: boolean; potProviderUrl: string | undefined; } {
	if (typeof config.port != "number") {
		throw new Error("Port must be a number");
	}

	if (typeof config.logLevel != "string" || !["none", "min", "info", "debug"].includes(config.logLevel)) {
		throw new Error("Invalid log level");
	}

	if (typeof config.cookiesFile != "string") {
		throw new Error("Cookies file must be a string");
	}

}

export function LoadConfig() {
	configDotenv({ quiet: true });

	const config = {
		port: process.env.PORT ? parseInt(process.env.PORT as string) : undefined,
		logLevel: process.env.LOG_LEVEL as string || "min",
		cookiesFile: process.env.COOKIES_FILE as string || "",
		accountAvailable: false,
		potProviderUrl: process.env.POT_PROVIDER_URL,
	};
	config.accountAvailable = config.cookiesFile != null && config.cookiesFile.length > 0;

	validate(config);

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
