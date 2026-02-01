import { createWriteStream, existsSync, mkdirSync, readdirSync, unlinkSync, WriteStream } from "fs";

export type Result = "success" | "error";

class LogManager {
	private file: WriteStream;

	private static pad(n: number): string {
		return n < 10 ? `0${n}` : `${n}`;
	}

	private static cleanOldLogs(dir: string, maxAgeDays: number): void {
		readdirSync(dir).forEach(file => {
			const match = file.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2}):(\d{2})\.log$/);
			if (match) {
				const year = parseInt(match[1], 10);
				const month = parseInt(match[2], 10) - 1;
				const day = parseInt(match[3], 10);
				const hour = parseInt(match[4], 10);
				const minute = parseInt(match[5], 10);
				const second = parseInt(match[6], 10);
				const fileDate = new Date(year, month, day, hour, minute, second);
				const ageMs = Date.now() - fileDate.getTime();
				const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
				if (ageMs > maxAgeMs) {
					try {
						const filePath = `${dir}/${file}`;
						console.log(`Deleting old log file: ${filePath}`);
						unlinkSync(filePath);
					} catch (err) {
						console.error(`Error deleting file ${file}:`, err);
					}
				}
			}
		});
	}

	constructor(folder: string, maxAgeDays: number = 7) {
		if (!existsSync(folder)) {
			mkdirSync(folder, { recursive: true });
		}

		LogManager.cleanOldLogs(folder, maxAgeDays);

		const today = new Date();
		const now = `${today.getFullYear()}-${LogManager.pad(today.getMonth() + 1)}-${LogManager.pad(today.getDate())}-${LogManager.pad(today.getHours())}:${LogManager.pad(today.getMinutes())}:${LogManager.pad(today.getSeconds())}`;
		this.file = createWriteStream(`${folder}/${now}.log`);

		this.file.write("id;start;end;result\n");
	}

	public log(message: any) {
		const logMessage = `${message}\n`;
		this.file.write(logMessage);
	}
}

export class RequestLogger {
	private nextId = 0;
	private processes: Record<number, number>; // ID -> startTime
	private logger: LogManager;

	constructor(logDir: string) {
		this.processes = {};

		this.logger = new LogManager(logDir);
	}

	/**
	 * Starts a performance measurement and returns a unique identifier.
	 * @returns A unique identifier for this performance measurement session.
	 */
	public start(): number {
		const id = this.nextId++;
		this.processes[id] = performance.now();

		return id;
	}

	private end(id: number) {
		const start = this.processes[id];
		delete this.processes[id];

		return start;
	}

	private write(id: number, result: Result) {
		if (!(id in this.processes)) {
			return;
		}

		const start = this.end(id);
		const end = performance.now();

		this.logger.log(`${id};${Math.round(start)};${Math.round(end)};${result}`);
	}

	public success(id: number) {
		this.write(id, "success");
	}

	public error(id: number) {
		this.write(id, "error");
	}
}
