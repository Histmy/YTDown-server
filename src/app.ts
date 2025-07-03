import express from "express";
import ytdl, { videoFormat, videoInfo } from "@distube/ytdl-core";
import { convert } from "./ffmpegConvert";

// Stolen and edited parser from ytdl-core
const validQueryDomains = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
]);
const validPathDomains = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts)\/)/;
const idRegex = /^[a-zA-Z0-9-_]{11}$/;
function validateURL(link: string): boolean {
  const parsed = new URL(link.trim());
  let id = parsed.searchParams.get('v');
  if (validPathDomains.test(link.trim()) && !id) {
    const paths = parsed.pathname.split('/');
    id = parsed.host === 'youtu.be' ? paths[1] : paths[2];
  } else if (parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
    return false;
  }
  if (!id) {
    return false;
  }
  id = id.substring(0, 11);
  if (!idRegex.test(id.trim())) {
    return false;
  }
  return true;
}

// Load config.json
const config = require("../config.json") as { port?: number, logLevel?: string; };
for (const key of Object.keys(config)) {
  if (!["port", "logLevel"].includes(key)) {
    throw new Error(`config.json contains an invalid key: ${key}`);
  }
}
if (typeof config.port != "number") {
  throw new Error("config.json is invalid");
}

// Update yt-dlp
require("@alpacamybags118/yt-dlp-exec/hooks/download-yt-dlp");

const logLevel = config.logLevel == "none" ? 0 : config.logLevel == "min" ? 1 : config.logLevel == "info" ? 2 : config.logLevel == "debug" ? 3 : 1;
const app = express();

function logAndExit(loging: any, res: express.Response, status: number, str: string) {
  log(2, loging);
  if (!res.headersSent) {
    res.status(status);
    res.setHeader("Content-Type", "text/plain; charset=UTF-8");
  }
  res.end(str);
}

function log(level: number, ...loging: any) {
  if (logLevel < level)
    return;

  const date = new Date();
  const time = `[${date.getDate()}.${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}]`;
  console.log(time, ...loging);
}

app.set("trust proxy", 1);
app.use(express.static(`${__dirname}/../static`));

// Allow cross-origin requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Expose-Headers", "*");
  if (req.method == "OPTIONS") {
    res.header("Access-Control-Allow-Headers", "*");
    return res.end();
  }
  next();
});

app.get("/stahnout", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return logAndExit("zadna url", res, 400, "zkus tu url tam zadat ok?");
  }
  log(2, url);

  if (typeof url != "string" || !validateURL(url)) {
    return logAndExit("invalidni url", res, 400, "cos to tam zadal?");
  }

  const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });

  stream.on("error", err => {
    if (err.message.includes("private video.")) {
      return logAndExit("soukrome video", res, 400, "Toto video je soukromé.");
    }
  });

  stream.once("info", (info: videoInfo, format: videoFormat) => {
    log(2, "info", info.videoDetails.title, format.contentLength);

    const title = info.videoDetails.title
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\")
      .replace(/[^\x00-\x7f]|[\/\\?<>:*|"]/g, "_"); // Also removes illegal characters from name

    res.setHeader("Content-Disposition", `attachment; filename="${title}.mp3"`)
      //.setHeader("Content-Length", format.contentLength)
      .setHeader("Content-Type", "audio/mp3");

    const mp3 = convert(stream);

    mp3.pipe(res)
      .on("finish", () => {
        log(2, "stahovani dokonceno");
      });
  });
});

app.all("/stahnout", (_, res) => {
  log(2, "\nstarej klient");
  res.setHeader("Content-Type", "text/plain; charset=UTF-8")
    .status(400)
    .end("Pravděpodobně používáte příliš starou verzi YTDown, nainstalujte si novější verzi pomocí návodu zde: https://support.mozilla.org/cs/kb/jak-aktualizovat-doplnky#w_aktualizace-doplnku");
});

app.all("/latest-version", (_, res) => {
  res.end("0.4");
});

app.listen(config.port, () => log(1, "server running"));
