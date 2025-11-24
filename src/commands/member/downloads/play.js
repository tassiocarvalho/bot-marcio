/**
 * Comando /play – pesquisa música no YouTube, baixa e envia como MP3.
 * Sistema simplificado usando script Python (yt-dlp) com suporte a cookies.
 */
import { fileURLToPath } from "node:url";
import InvalidParameterError from "../../../errors/InvalidParameterError.js";
import yts from "yt-search";
import fs from "node:fs";
import path from "node:path";
import { exec as execChild } from "node:child_process";
import { promisify } from "node:util";
import { PREFIX, TEMP_DIR } from "../../../config.js";
import { getRandomName } from "../../../utils/index.js";

const exec = promisify(execChild);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIES_PATH = path.join(__dirname, "youtube_cookies.txt");


// ============================================
// SISTEMA DE DOWNLOAD SIMPLIFICADO (via Python)
// ============================================

/**
 * Tenta fazer download do áudio do YouTube como MP3 usando um script Python.
 * @param {string} videoUrl URL do vídeo do YouTube.
 * @param {string} outputPath Caminho base para o arquivo de saída (sem extensão).
 * @returns {Promise<string|null>} Caminho completo do arquivo MP3 ou null em caso de falha.
 */
async function downloadMp3(videoUrl, outputPath) {
  const pythonScriptPath = path.join(__dirname, "../../../services/yt_download.py");
  
  console.log("[DOWNLOAD] Iniciando download via script Python...");
  
  let command = `python3 ${pythonScriptPath} "${videoUrl}" "${outputPath}"`;
  
  // Adiciona o caminho dos cookies se o arquivo existir
  if (fs.existsSync(COOKIES_PATH)) {
    command += ` "${COOKIES_PATH}"`;
    console.log(`[DOWNLOAD] Cookies encontrados! Usando: ${COOKIES_PATH}`);
  } else {
    console.log("[DOWNLOAD] Cookies não encontrados. Tentando sem autenticação.");
  }

  try {
    const { stdout, stderr } = await exec(command, { timeout: 120000 }); // 2 minutos de timeout
    
    // O script Python imprime logs de cookies no stderr
    if (stderr) {
        console.log(`[PYTHON LOG] ${stderr.trim()}`);
    }

    const result = JSON.parse(stdout.trim());
    
    if (result.success && fs.existsSync(result.path)) {
      console.log(`[DOWNLOAD] ✓ Sucesso! Arquivo: ${result.path}`);
      return result.path;
    } else {
      console.error(`[DOWNLOAD] ✗ Falha no script Python: ${result.error}`);
      return null;
    }
  } catch (err) {
    console.error(`[DOWNLOAD] ✗ Erro ao executar script Python: ${err.message}`);
    return null;
  }
}


// ============================================
// COMANDO /PLAY
// ============================================

export default {
  name: "play",
  description: "Baixa música do YouTube como MP3.",
  commands: ["play"],
  usage: `${PREFIX}play <nome da música>`,

  handle: async ({ args, sendReply, sendWaitReact, sendSuccessReact, sendErrorReply, sendAudioFromFile }) => {
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
      
      // Verifica a duração (15 minutos = 900 segundos)
      const durationInSeconds = info.seconds;
      const MAX_DURATION_SECONDS = 900; // 15 minutos

      if (durationInSeconds > MAX_DURATION_SECONDS) {
        const maxDurationMinutes = MAX_DURATION_SECONDS / 60;
        return sendReply(
          `❌ O vídeo encontrado tem ${info.timestamp} (${durationInSeconds}s). ` +
          `O limite máximo para download de MP3 é de ${maxDurationMinutes} minutos.`
        );
      }

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
    const tempOutputBase = path.join(TEMP_DIR, getRandomName("audio"));
    let tempOutput = null; // Declara tempOutput no escopo do try/catch/finally

    try {
      // Download e Conversão (tudo em um no script Python)
      const tempOutputPath = await downloadMp3(videoUrl, tempOutputBase);

      if (!tempOutputPath) {
        console.error("[PLAY] Download falhou completamente");
        return sendErrorReply(
          "❌ Não foi possível baixar o áudio.\n\n" +
          "💡 *Tente:*\n" +
          "• Outra música\n" +
          "• Aguardar alguns minutos"
        );
      }

      // O script Python já retorna o caminho do MP3
      tempOutput = tempOutputPath;

      const fileSize = fs.statSync(tempOutput).size;
      console.log(`[PLAY] ✓ MP3 pronto: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      await sendSuccessReact();
      
      // A função correta para enviar o MP3 é sendAudioFromFile
      if (typeof sendAudioFromFile === 'function') {
        await sendAudioFromFile(tempOutput, false, true); // false = não como voice, true = quoted
      } else {
        await sendReply("❌ Erro: A função de envio de áudio não está disponível. O download foi concluído, mas o envio falhou.");
      }
      
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
        if (tempOutput && fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      } catch (cleanErr) {
        console.error("[PLAY] Erro na limpeza:", cleanErr);
      }
    }
  },
};