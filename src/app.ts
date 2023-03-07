import express from "express";
import { getInfo, validateURL } from "ytdl-core";
import createYtDlpAsProcess from "@alpacamybags118/yt-dlp-exec";
import { WsClovekData, SocketState, JSONData } from "./types";
import { WebSocketServer } from "ws";
import { compare } from "compare-versions";
import ffmpeg from "fluent-ffmpeg";

const arg2 = process.argv[2];
const logLevel = arg2 == "min" ? 1 : arg2 == "all" ? 2 : 0;
const app = express();
const wsServer = new WebSocketServer({ port: 6343 });

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
  if (logLevel >= level) console.log(...loging);
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
  const nazevPomise = getInfo(url).then(info => {
    // Only ASCII characters can be sent in HTTP headers
    title = info.videoDetails.title.replace(/[^\x00-\x7f]|[\/\\?<>:*|"]/g, "_"); // Also removes illegal characters from name
    res.setHeader("Content-Disposition", `attachment; filename=${title}.mp3`);
    log(2, "name:", title);
  }).catch((e: Error) => {
    if (e.message.indexOf("private") != -1) {
      ytdlpProc.kill();
      logAndExit("soukrome video", res, 400, "Toto video je soukromé.");
    }
    else logAndExit({ t: "ytdl err", e }, res, 500, "Došlo k neočekávané chybě. Zkuste no znovu nebo později.");
  });

  const ytdlpProc = createYtDlpAsProcess(url, {
    o: "-",
    f: "ba"
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
  if (typeof id == "string" && pripojeni[id])
    ytdlpProc.stderr?.on("data", ch => {
      if (!Buffer.isBuffer(ch) || !pripojeni[id]) return;
      const data = ch.toString();
      const regex = /^\r\[download\] *(?<p>\d+(?:\.\d+))% *of *~? *(?<si>\d+\.\d+)(?<u>\w+) *at *(?<sp>\d+\.\d+\w+\/s|Unknown speed) *ETA *(?<e>\d\d:\d\d|Unknown ETA)/;
      const vysledek = regex.exec(data);
      if (!vysledek) return;
      const g = vysledek.groups!;
      pripojeni[id].downloading = true;
      pripojeni[id].progress = Math.round(Number(g.p));
      if (g.e != "Unknown ETA") pripojeni[id].eta = g.e;
    });

  await nazevPomise;
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

app.listen(6699, () => log(1, "server running"));
