import ytdl from "youtube-dl-exec";
import { log } from "./utils";

const TIMEOUT = 30_000;

export async function download(url: string) {

	log(3, "begin download");

	const json = await getInfo(url);

	log(3, "got info");

	const data = JSON.parse(json);

	log(3, "parsed json");

	const title = data.title;
	const duration = data.duration;

	if (typeof title != "string" || typeof duration != "number" || duration <= 0) {
		throw new Error("invalid data");
	}

	log(3, "begin second download from json");

	const stream = downloadFromInfo(json);

	log(3, "got stream");

	return {
		stream,
		title,
		duration
	};
}

const getInfo = (url: string) => new Promise<string>((res, rej) => {
	const process = ytdl.exec(url, {
		addHeader: ["referer:youtube.com", "user-agent:googlebot"],
		dumpJson: true,
		skipDownload: true
	});

	const timeout = setTimeout(() => {
		process.kill();
		rej(new Error("timeout"));
	}, TIMEOUT);

	let json = "";
	let err = "";

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

		if (json && !err) {
			res(json);
		} else {
			rej(err);
		}
	});
});

function downloadFromInfo(json: string) {
	const process = ytdl.exec("", {
		addHeader: ["referer:youtube.com", "user-agent:googlebot"],
		format: "ba",
		loadInfoJson: "-",
		output: "-"
	});

	const stdout = process.stdout;

	if (!stdout) {
		throw new Error("stdout not available");
	}

	process.stdin?.end(json);

	return stdout;
}
