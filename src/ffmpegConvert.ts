import { Readable } from "stream";
import { spawn } from "child_process";

export const convert = (inputStream: Readable) => new Promise<Readable>((res, rej) => {
  const process = spawn("ffmpeg", [
    "-i", "pipe:0", // Input from stdin
    "-f", "mp3", // Output format
    "pipe:1", // Output to stdout
  ]);

  process.on("error", (err) => {
    rej(new Error(`FFmpeg process failed: ${err.message}`));
  });

  process.once("spawn", () => {
    inputStream.pipe(process.stdin);

    res(process.stdout);
  });
});
