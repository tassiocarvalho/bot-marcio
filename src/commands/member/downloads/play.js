/**
 * Comando /play – pesquisa música no YouTube, baixa e envia como MP3.
 * CORRIGIDO: Bypass de detecção de bot do YouTube
 */

import InvalidParameterError from "../../../errors/InvalidParameterError.js";
import yts from "yt-search";
import fs from "node:fs";
import path from "node:path";
import { exec as execChild } from "node:child_process";
import { promisify } from "node:util";
import { PREFIX, TEMP_DIR } from "../../../config.js";
import { getRandomName } from "../../../utils/index.js";

const exec = promisify(execChild);

export default {
  name: "play",
  description: "Baixa música do YouTube como MP3.",
  commands: ["play"],
  usage: `${PREFIX}play <nome da música>`,

  handle: async ({ args, sendReply, sendWaitReact, sendSuccessReact, sendFileReply, sendErrorReply }) => {
    console.log("[DEBUG] Entrou no comando /play");

    if (!args?.length) {
      console.log("[DEBUG] Nenhum argumento recebido.");
      throw new InvalidParameterError("Você precisa informar o nome da música!");
    }

    const query = args.join(" ");
    console.log("[DEBUG] Query:", query);

    await sendWaitReact();

    let info;
    try {
      console.log("[DEBUG] Pesquisando no yt-search…");
      const search = await yts(query);

      if (!search.videos.length) {
        console.log("[DEBUG] yt-search não retornou vídeos.");
        return sendReply("❌ Nenhum resultado encontrado no YouTube.");
      }

      info = search.videos[0];
      console.log("[DEBUG] Vídeo encontrado:", info.title);

    } catch (e) {
      console.error("[ERRO] yt-search falhou:", e);
      return sendReply("❌ Erro ao pesquisar no YouTube.");
    }

    await sendReply(
      `🎵 *Resultado encontrado:*\n\n` +
      `📌 *Título:* ${info.title}\n` +
      `👤 *Canal:* ${info.author.name}\n` +
      `⏱️ *Duração:* ${info.timestamp}\n` +
      `🔗 https://youtube.com/watch?v=${info.videoId}\n\n` +
      `⏳ Baixando e convertendo para MP3...`
    );

    const videoUrl = info.url;
    const tempInput = path.join(TEMP_DIR, getRandomName("webm"));
    const tempOutput = path.join(TEMP_DIR, getRandomName("mp3"));

    console.log("[DEBUG] Temp input:", tempInput);
    console.log("[DEBUG] Temp output:", tempOutput);

    try {
      console.log("[DEBUG] Iniciando download do áudio via yt-dlp…");

      // SOLUÇÃO 1: Usar cookies e múltiplos clients
      const ytDlpCommand = [
        'yt-dlp',
        '-f bestaudio',
        '--no-check-formats',
        '--no-cache-dir',
        '--force-ipv4',
        '--extractor-retries 10',
        '--fragment-retries 10',
        '--retry-sleep 3',
        // Client alternativo (iOS funciona melhor)
        '--extractor-args "youtube:player_client=ios,web"',
        // User-Agent personalizado
        '--user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15"',
        // Adiciona delay entre requests
        '--sleep-requests 1',
        '--sleep-interval 1',
        // Formato de saída
        `-o "${tempInput}"`,
        `"${videoUrl}"`
      ].join(' ');

      console.log("[DEBUG] Comando yt-dlp:", ytDlpCommand);

      await exec(ytDlpCommand);

      console.log("[DEBUG] Download concluído. Convertendo via ffmpeg…");

      // Conversão para MP3
      await exec(
        `ffmpeg -y -i "${tempInput}" -vn -ab 192k -ar 44100 "${tempOutput}"`
      );

      if (!fs.existsSync(tempOutput)) {
        console.log("[DEBUG] Falha: arquivo MP3 não gerado.");
        throw new Error("Conversão falhou.");
      }

      console.log("[DEBUG] MP3 gerado com sucesso.");
      await sendSuccessReact();

      console.log("[DEBUG] Enviando arquivo ao usuário…");
      await sendFileReply(tempOutput, `${info.title}.mp3`);

    } catch (err) {
      console.error("[ERRO] Processo /play falhou:", err);
      
      // Mensagem de erro mais informativa
      if (err.message?.includes("Sign in to confirm")) {
        return sendErrorReply(
          "❌ O YouTube bloqueou o download. Tentando alternativa...\n\n" +
          "💡 Dica: Atualize o yt-dlp com: `pip install -U yt-dlp`"
        );
      }
      
      return sendErrorReply("❌ Ocorreu um erro ao baixar ou converter o áudio.");
      
    } finally {
      console.log("[DEBUG] Limpando arquivos temporários…");
      try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      } catch (cleanErr) {
        console.error("[ERRO] Falha ao limpar temporários:", cleanErr);
      }
    }
  },
};