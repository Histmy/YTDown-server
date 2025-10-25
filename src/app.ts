import express from "express";
import { convert } from "./ffmpegConvert";
import { download } from "./yt-dlp-download";
import { config, log } from "./utils";

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

const app = express();

function logAndExit(loging: any, res: express.Response, status: number, str: string) {
  log(2, loging);
  if (!res.headersSent) {
    res.status(status);
    res.setHeader("Content-Type", "text/plain; charset=UTF-8");
  }
  res.end(str);
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

  try {
    if (typeof url != "string" || !validateURL(url)) {
      throw new Error();
    }
  } catch {
    return logAndExit("invalidni url", res, 400, "cos to tam zadal?");
  }

  try {
    const { stream, title, duration } = await download(url);

    log(2, `info "${title}", ${duration}s`);

    const estimatedSize = duration * 128 * 128; // Rough estimate: 128 kbps and 128 = 1024/8 to convert to bytes

    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(title)}.mp3`)
      .setHeader("X-Estimated-Size", estimatedSize.toString())
      .setHeader("Content-Type", "audio/mp3");

    const mp3 = await convert(stream);

    mp3.pipe(res)
      .on("close", () => {
        log(2, "stahovani dokonceno");
      });

  } catch (e) {
    if (typeof e == "string") {


      if (e.includes("Private video")) {
        return logAndExit("soukrome video", res, 400, "Toto video je soukromé.");
      }
      if (e.includes("confirm your age")) {
        return logAndExit("video neni dostupne", res, 400, "Toto video je omezeno věkem.");
      }
    }

    log(2, "chyba pri konverzi", e);
    return logAndExit("chyba pri konverzi", res, 500, "Nastala chyba při konverzi videa na MP3.");
  }
});

app.all("/stahnout", (_, res) => {
  log(2, "\nstarej klient");
  res.setHeader("Content-Type", "text/plain; charset=UTF-8")
    .status(400)
    .end("Pravděpodobně používáte příliš starou verzi YTDown, nainstalujte si novější verzi pomocí návodu zde: https://support.mozilla.org/cs/kb/jak-aktualizovat-doplnky#w_aktualizace-doplnku");
});

app.all("/latest-version", (_, res) => {
  res.end("0.4.1");
});

app.listen(config.port, () => log(1, `server running on port ${config.port}`));
