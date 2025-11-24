/**
 * Comando /play – pesquisa música no YouTube, baixa e envia como MP3.
 * Sistema completo com proxy rotativo + auto-atualização + múltiplas estratégias
 */
import { fileURLToPath } from "node:url";
import InvalidParameterError from "../../../errors/InvalidParameterError.js";
import yts from "yt-search";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { exec as execChild } from "node:child_process";
import { promisify } from "node:util";
import { PREFIX, TEMP_DIR } from "../../../config.js";
import { getRandomName } from "../../../utils/index.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIES_PATH = path.join(__dirname, "youtube_cookies.json");

const exec = promisify(execChild);

// ============================================
// SISTEMA DE PROXIES
// ============================================

let PROXY_CACHE = null;
let PROXY_CACHE_TIME = 0;
const PROXY_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 horas

// Fontes de proxies SOCKS5 gratuitos
const PROXY_SOURCES = [
  "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt"
];

// Proxies padrão (fallback caso as fontes falhem)
const DEFAULT_PROXIES = [
  "socks5://167.99.109.153:1080",
  "socks5://192.111.139.165:4145",
  "socks5://98.162.25.23:4145",
  "socks5://72.195.34.59:4145",
  "socks5://184.178.172.25:15291"
];

// Busca proxies de uma URL
function fetchProxiesFromUrl(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout"));
    }, 10000);

    https.get(url, (res) => {
      let data = "";
      
      res.on("data", (chunk) => {
        data += chunk;
      });
      
      res.on("end", () => {
        clearTimeout(timeout);
        const proxies = data
          .split("\n")
          .map(line => line.trim())
          .filter(line => line && !line.startsWith("#"))
          .filter(line => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(line))
          .map(proxy => `socks5://${proxy}`);
        
        resolve(proxies);
      });
    }).on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Busca e atualiza lista de proxies
async function fetchFreshProxies() {
  console.log("[PROXY] Buscando proxies atualizados...");
  const allProxies = new Set(DEFAULT_PROXIES);

  for (const source of PROXY_SOURCES) {
    try {
      const proxies = await fetchProxiesFromUrl(source);
      proxies.slice(0, 20).forEach(p => allProxies.add(p));
      console.log(`[PROXY] ✓ ${proxies.length} proxies de ${source.split("/")[2]}`);
    } catch (err) {
      console.log(`[PROXY] ✗ Falhou: ${source.split("/")[2]}`);
    }
  }

  const proxyArray = Array.from(allProxies);
  console.log(`[PROXY] Total: ${proxyArray.length} proxies`);
  return proxyArray;
}

// Obtém lista de proxies (usa cache se disponível)
async function getProxyList() {
  const now = Date.now();
  
  if (PROXY_CACHE && (now - PROXY_CACHE_TIME) < PROXY_CACHE_DURATION) {
    console.log("[PROXY] Usando cache de proxies");
    return PROXY_CACHE;
  }

  try {
    PROXY_CACHE = await fetchFreshProxies();
    PROXY_CACHE_TIME = now;
    return PROXY_CACHE;
  } catch (err) {
    console.error("[PROXY] Erro ao buscar proxies, usando padrões:", err.message);
    return DEFAULT_PROXIES;
  }
}

// Testa se um proxy está funcionando
async function testProxy(proxy) {
  try {
    const cmd = `timeout 8 yt-dlp --proxy "${proxy}" --no-warnings --skip-download --get-title "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 2>&1`;
    await exec(cmd);
    return true;
  } catch {
    return false;
  }
}

// Encontra o melhor proxy disponível
async function getBestProxy() {
  const proxies = await getProxyList();
  console.log(`[PROXY] Testando até 5 proxies...`);
  
  for (let i = 0; i < Math.min(5, proxies.length); i++) {
    const proxy = proxies[i];
    console.log(`[PROXY] Testando [${i + 1}/5]: ${proxy.substring(0, 30)}...`);
    
    const works = await testProxy(proxy);
    
    if (works) {
      console.log(`[PROXY] ✓ Proxy selecionado!`);
      return proxy;
    }
  }
  
  console.log("[PROXY] Nenhum proxy disponível");
  return null;
}

// ============================================
// SISTEMA DE DOWNLOAD
// ============================================

// Estratégias de download do YouTube
const DOWNLOAD_STRATEGIES = [
  {
    name: "android_music",
    args: [
      '-f bestaudio',
      '--extractor-args "youtube:player_client=android_music"',
      '--no-check-certificate',
      '--geo-bypass'
    ]
  },
  {
    name: "mediaconnect",
    args: [
      '-f bestaudio',
      '--extractor-args "youtube:player_client=mediaconnect"',
      '--no-check-certificate'
    ]
  },
  {
    name: "mweb",
    args: [
      '-f bestaudio',
      '--extractor-args "youtube:player_client=mweb"',
      '--user-agent "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36"'
    ]
  },
  {
    name: "web_embed",
    args: [
      '-f bestaudio',
      '--extractor-args "youtube:player_skip=webpage,configs"',
      '--no-check-certificate'
    ]
  }
];

// Tenta fazer download com diferentes estratégias
async function tryDownload(videoUrl, outputPath, useProxy = true) {
  let proxy = null;
  
  if (useProxy) {
    try {
      proxy = await getBestProxy();
    } catch (err) {
      console.log("[DOWNLOAD] Erro ao obter proxy:", err.message);
    }
  }

  for (let i = 0; i < DOWNLOAD_STRATEGIES.length; i++) {
    const strategy = DOWNLOAD_STRATEGIES[i];
    
    console.log(`[DOWNLOAD] Tentativa ${i + 1}/${DOWNLOAD_STRATEGIES.length}: ${strategy.name}${proxy ? ' + proxy' : ' sem proxy'}`);

    const baseArgs = [
      '--no-cache-dir',
      '--force-ipv4',
      '--extractor-retries 3',
      '--fragment-retries 3',
      '--no-warnings',
      '--no-check-formats',
      '--socket-timeout 30',
      '--quiet',
      '--no-progress'
    ];

    if (proxy) {
      baseArgs.push(`--proxy "${proxy}"`);
    }

    if (fs.existsSync(COOKIES_PATH)) {
      baseArgs.push(`--cookies "${COOKIES_PATH}"`);
    }

    const ytDlpCommand = [
      'yt-dlp',
      ...strategy.args,
      ...baseArgs,
      `-o "${outputPath}"`,
      `"${videoUrl}"`
    ].join(' ');

    try {
      await exec(ytDlpCommand, { timeout: 90000 });
      
      if (fs.existsSync(outputPath)) {
        console.log(`[DOWNLOAD] ✓ Sucesso com ${strategy.name}!`);
        return true;
      }
    } catch (err) {
      console.error(`[DOWNLOAD] ✗ ${strategy.name} falhou`);
      
      // Se falhou com todas estratégias + proxy, tenta sem proxy
      if (proxy && i === DOWNLOAD_STRATEGIES.length - 1) {
        console.log("[DOWNLOAD] Tentando novamente SEM proxy...");
        return tryDownload(videoUrl, outputPath, false);
      }
      
      if (i < DOWNLOAD_STRATEGIES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  return false;
}

// ============================================
// COMANDO /PLAY
// ============================================

export default {
  name: "play",
  description: "Baixa música do YouTube como MP3.",
  commands: ["play"],
  usage: `${PREFIX}play <nome da música>`,

  handle: async ({ args, sendReply, sendWaitReact, sendSuccessReact, sendFileReply, sendErrorReply }) => {
    console.log("\n[PLAY] ========== INICIANDO ==========");

    if (!args?.length) {
      throw new InvalidParameterError("Você precisa informar o nome da música!");
    }

    const query = args.join(" ");
    console.log(`[PLAY] Query: ${query}`);

    await sendWaitReact();

    // Busca no YouTube
    let info;
    try {
      console.log("[PLAY] Pesquisando no YouTube...");
      const search = await yts(query);

      if (!search.videos.length) {
        return sendReply("❌ Nenhum resultado encontrado no YouTube.");
      }

      info = search.videos[0];
      console.log(`[PLAY] Encontrado: ${info.title}`);

    } catch (e) {
      console.error("[PLAY] Erro na busca:", e);
      return sendReply("❌ Erro ao pesquisar no YouTube.");
    }

    await sendReply(
      `🎵 *Encontrado:*\n\n` +
      `📌 ${info.title}\n` +
      `👤 ${info.author.name}\n` +
      `⏱️ ${info.timestamp}\n` +
      `🔗 https://youtube.com/watch?v=${info.videoId}\n\n` +
      `⏳ Baixando... (pode levar até 2 minutos)`
    );

    const videoUrl = info.url;
    const tempInput = path.join(TEMP_DIR, getRandomName("webm"));
    const tempOutput = path.join(TEMP_DIR, getRandomName("mp3"));

    try {
      // Download
      console.log("[PLAY] Iniciando download...");
      const downloadSuccess = await tryDownload(videoUrl, tempInput, true);

      if (!downloadSuccess) {
        console.error("[PLAY] Download falhou completamente");
        return sendErrorReply(
          "❌ Não foi possível baixar o áudio.\n\n" +
          "💡 *Tente:*\n" +
          "• Atualizar yt-dlp: `pip install -U yt-dlp`\n" +
          "• Outra música\n" +
          "• Aguardar alguns minutos"
        );
      }

      // Conversão
      console.log("[PLAY] Convertendo para MP3...");
      await exec(
        `ffmpeg -y -loglevel error -i "${tempInput}" -vn -ab 192k -ar 44100 -ac 2 "${tempOutput}"`,
        { timeout: 120000 }
      );

      if (!fs.existsSync(tempOutput)) {
        throw new Error("Conversão falhou");
      }

      const fileSize = fs.statSync(tempOutput).size;
      console.log(`[PLAY] ✓ MP3 pronto: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      await sendSuccessReact();
      await sendFileReply(tempOutput, `${info.title}.mp3`);
      
      console.log("[PLAY] ========== CONCLUÍDO ==========\n");

    } catch (err) {
      console.error("[PLAY] Erro:", err);
      
      if (err.killed || err.signal === 'SIGTERM') {
        return sendErrorReply("❌ Tempo limite excedido.");
      }
      
      if (err.message?.includes("ffmpeg")) {
        return sendErrorReply("❌ Erro no ffmpeg. Verifique a instalação: `sudo apt install ffmpeg`");
      }
      
      return sendErrorReply("❌ Erro ao processar o áudio.");
      
    } finally {
      // Limpeza
      try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      } catch (cleanErr) {
        console.error("[PLAY] Erro na limpeza:", cleanErr);
      }
    }
  },
};