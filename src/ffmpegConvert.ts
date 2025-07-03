import { Readable } from "stream";
import { spawn } from "child_process";

export function convert(inputStream: Readable): Readable {
  const process = spawn("ffmpeg", [
    "-i", "pipe:0", // Input from stdin
    "-f", "mp3", // Output format
    "pipe:1", // Output to stdout
  ]);

  inputStream.pipe(process.stdin);

  return process.stdout;
}
