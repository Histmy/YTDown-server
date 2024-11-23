import express from "express";
import createYtDlpAsProcess from "@alpacamybags118/yt-dlp-exec";
import { WsClovekData, SocketState, JSONData } from "./types";
import { WebSocketServer } from "ws";
import { compare } from "compare-versions";
import ffmpeg from "fluent-ffmpeg";

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
const config = require("./config.json") as { portHttp?: number, portWs?: number, logLevel?: string; };
for (const key of Object.keys(config)) {
  if (!["portHttp", "portWs", "logLevel"].includes(key)) {
    throw new Error(`config.json contains an invalid key: ${key}`);
  }
}
if (typeof config.portHttp != "number" || typeof config.portWs != "number" || typeof config.logLevel != "string") {
  throw new Error("config.json is invalid");
}

// Update yt-dlp
require("@alpacamybags118/yt-dlp-exec/hooks/download-yt-dlp");

const logLevel = config.logLevel == "none" ? 0 : config.logLevel == "min" ? 1 : config.logLevel == "max" ? 2 : 1;
const app = express();
const wsServer = new WebSocketServer({ port: config.portWs });

function logAndExit(loging: any, res: express.Response, status: number, str: string) {
  log(1, loging);
  if (!res.headersSent) res.status(status);
  res.end(str);
}

function safeParseJSON(data: string): JSONData | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function log(level: number, ...loging: any) {
  if (logLevel < level)
    return;

  const date = new Date();
  const time = `[${date.getDate()}.${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}]`;
  console.log(time, ...loging);
}

const pripojeni: Record<string, WsClovekData> = {};
wsServer.on("connection", ws => {
  let id: string;
  do {
    id = `${Math.random()}`.slice(2);
  } while (pripojeni[id]);
  const obj: WsClovekData = { downloading: false, state: SocketState.handshake };
  pripojeni[id] = obj;
  log(2, id, "connected");

  // Disconnect if handshake not complete after 5s
  setTimeout(() => {
    if (obj.state == SocketState.handshake) ws.close(4001);
  }, 5e3);

  ws.on("message", m => {
    const json = safeParseJSON(m.toString());
    if (!json) return ws.close(4002);

    switch (obj.state) {
      case SocketState.handshake:
        if (json.id != 0 || !json.version) return ws.close(4003);
        if (compare(json.version, "0.3", "<")) return ws.close(4004);
        obj.version = json.version;
        obj.state = SocketState.downloading;
        ws.send(JSON.stringify({ id: 1, socId: id }));
        break;

      case SocketState.downloading:
        if (json.id != 0) return ws.close(4003);
        ws.send(JSON.stringify({ downloading: obj.downloading, progress: obj.progress, eta: obj.eta }));
        break;
    }
  });

  ws.on("close", code => {
    log(2, id, "disconnected, code:", code);
    delete pripojeni[id];
  });
});

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
  if (!url) return logAndExit("zadna url", res, 400, "zkus tu url tam zadat ok?");
  log(2, url);

  if (typeof url != "string" || !validateURL(url)) return logAndExit("invalidni url", res, 400, "cos to tam zadal?");

  let title: string;
  let nazevResover: () => void;
  const nazevPromise = new Promise<void>(resolve => nazevResover = resolve).then(() => {
    res.setHeader("Content-Disposition", `attachment; filename=${title}.mp3`);
    log(2, "name:", title);
  });

  const ytdlpProc = createYtDlpAsProcess(url, {
    o: "-",
    f: "ba",
    "parse-metadata": "title:%(title)s"
  }, { stdio: "pipe" });

  const efefempeg = ffmpeg(ytdlpProc.stdout!).format("mp3").on("error", (err: Error) => {
    if (err.message == "Output stream closed" || err.message.startsWith("ffmpeg exited with code 255")) return;
    if (err.message.startsWith("ffmpeg was killed")) return log(1, "ffmpeg was killed");
    logAndExit({ t: "ffmpeg error", e: err }, res, 500, "neco se nepovedlo");
  });

  res.on("close", () => {
    ytdlpProc.kill("SIGINT");
    efefempeg.kill("SIGINT");
  });

  const id = req.query.id;
  // Parsing of yt-dlp output
  ytdlpProc.stderr?.on("data", ch => {
    if (!Buffer.isBuffer(ch)) return;
    const data = ch.toString().trim();

    if (true) {
      const textForPrint = data.replace(/\r/g, "");
      log(2, textForPrint);
    }

    // Check for errors
    if (data.startsWith("ERROR:")) {
      if (data.indexOf("Private video.") != -1) {
        logAndExit("soukrome video", res, 400, "Toto video je soukromé.");
      }
      else logAndExit({ t: "ytdl err", data }, res, 500, "Došlo k neočekávané chybě. Zkuste to znovu nebo později.");
    }

    // Check for title
    if (!title && data.startsWith("[MetadataParser]")) {
      title = data.match(data.endsWith("'") ? /.+?': '(?<t>.+)'$/ : /.+?"(?<t>.+)"$/)?.groups?.t ?? "Unknown title";
      title = title.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
      title = title.replace(/[^\x00-\x7f]|[\/\\?<>:*|"]/g, "_"); // Also removes illegal characters from name
      nazevResover();
      return;
    }
    if (typeof id != "string" || !pripojeni[id]) return;

    const regex = /^\[download\] *(?<p>\d+(?:\.\d+))% *of *~? *(?<si>\d+\.\d+)(?<u>\w+) *at *(?<sp>\d+\.\d+\w+\/s|Unknown speed) *ETA *(?<e>\d\d:\d\d|Unknown ETA)/;
    const vysledek = regex.exec(data);
    if (!vysledek) return;
    const g = vysledek.groups!;
    pripojeni[id].downloading = true;
    pripojeni[id].progress = Math.round(Number(g.p));
    if (g.e != "Unknown ETA") pripojeni[id].eta = g.e;
  });

  await nazevPromise;
  efefempeg.stream(res, { end: true }).on("finish", () => log(2, "uspesne stazeno"));
});

app.all("/stahnout", (_, res) => {
  log(2, "\nstarej klient");
  res.setHeader("Content-Type", "text/plain; charset=UTF-8")
    .status(400)
    .end("Pravděpodobně používáte příliš starou verzi YTDown, nainstalujte si novější verzi pomocí návodu zde: https://support.mozilla.org/cs/kb/jak-aktualizovat-doplnky#w_aktualizace-doplnku");
});

app.all("/latest-version", (_, res) => {
  res.end("0.3");
});

app.listen(config.portHttp, () => log(1, "server running"));
