import ytdl, { Flags } from "youtube-dl-exec";
import { config, log } from "./utils";

type Ok<T> = { type: "ok"; value: T; };
type Err<E> = { type: "err"; error: E; };
type Result<T, E> = Ok<T> | Err<E>;

const TIMEOUT = 30_000;

const baseConfig: Flags = {
	addHeader: ["referer:youtube.com", "user-agent:googlebot"],
	jsRuntimes: "node"
};

const accountConfig: Flags = {
	...baseConfig,
	cookies: "cookies.txt"
};

async function getInfo(url: string) {
	const json = await tryGetInfo(url, false);

	if (json.type == "ok") {
		return { result: json.value, ageRestricted: false };
	}

	if (!json.error.includes("confirm your age")) {
		throw json.error;
	}

	if (!config.accountAvailable) {
		throw new Error("video is age-restricted and account is not available");
	}

	log(2, "video is age-restricted, trying with account");

	const jsonWithAccount = await tryGetInfo(url, true);

	if (jsonWithAccount.type == "ok") {
		return { result: jsonWithAccount.value, ageRestricted: true };
	}

	throw jsonWithAccount.error;
}

export async function download(url: string) {

	log(3, "begin download");

	const { result, ageRestricted } = await getInfo(url);

	log(3, "got info");

	const data = JSON.parse(result);

	log(3, "parsed json");

	const title = data.title;
	const duration = data.duration;

	if (typeof title != "string" || typeof duration != "number" || duration <= 0) {
		throw new Error("invalid data");
	}

	log(3, "begin second download from json");

	const stream = downloadFromInfo(result, ageRestricted);

	log(3, "got stream");

	return {
		stream,
		title,
		duration
	};
}

const tryGetInfo = (url: string, withAccount: boolean) => new Promise<Result<string, string>>(res => {
	const process = ytdl.exec(url, {
		... (withAccount ? accountConfig : baseConfig),
		dumpJson: true,
		skipDownload: true,
	});

	let json = "";
	let err = "";

	const timeout = setTimeout(() => {
		process.kill();
		res({ type: "err", error: "timeout " + err });
	}, TIMEOUT);

	process.catch(e => {
		log(3, "yt-dlp exec error", e);

		// clearTimeout(timeout);
		// rej(err);
	});

	process.stdout?.on("data", (data: Buffer) => {
		const text = data.toString();
		json += text;
	});

	process.stderr?.on("data", (data: Buffer) => {
		const text = data.toString();
		err += text;
	});

	process.on("exit", () => {
		clearTimeout(timeout);

		if (json) {
			res({ type: "ok", value: json });
		} else if (err) {
			res({ type: "err", error: err });
		} else {
			res({ type: "err", error: "no output" });
		}
	});
});

function downloadFromInfo(json: string, withAccount: boolean) {
	const process = ytdl.exec("", {
		... (withAccount ? accountConfig : baseConfig),
		format: "ba",
		loadInfoJson: "-",
		output: "-",
	});

	const stdout = process.stdout;

	if (!stdout) {
		throw new Error("stdout not available");
	}

	process.stdin?.end(json);

	return stdout;
}
