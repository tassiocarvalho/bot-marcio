/**
 * Comando /play – pesquisa música no YouTube, baixa e envia como MP3.
 */

import InvalidParameterError from "../../../errors/InvalidParameterError.js";
import yts from "yt-search";
import fs from "node:fs";
import path from "node:path";
import { exec as execChild } from "node:child_process";
import { promisify } from "node:util";
import { PREFIX, TEMP_DIR } from "../../../config.js";
import { getRandomName } from "../../../utils/index.js";
// import ytDlp from "yt-dlp-exec"; // Substituído por exec do shell

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
        return sendReply("❌ Nenhum resultado encontrado no YouTube."); // CORRIGIDO: sendTextReply -> sendReply
      }

      info = search.videos[0];
      console.log("[DEBUG] Vídeo encontrado:", info.title);

    } catch (e) {
      console.error("[ERRO] yt-search falhou:", e);
      return sendReply("❌ Erro ao pesquisar no YouTube."); // CORRIGIDO: sendTextReply -> sendReply
    }

    await sendReply( // CORRIGIDO: sendTextReply -> sendReply
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
      console.log("[DEBUG] Iniciando download via yt-dlp…");

      // Usar yt-dlp para baixar o áudio e convertê-lo diretamente para MP3 usando ffmpeg
      // O yt-dlp cuidará da conversão para MP3 se o formato for especificado.
      // O nome do arquivo de saída será o nome do arquivo temporário MP3.
      // O yt-dlp usa o ffmpeg automaticamente para a conversão.
      await exec(
        `yt-dlp -x --audio-format mp3 --no-check-formats --no-cache-dir -o "${tempOutput}" "${videoUrl}"`
      );

      console.log("[DEBUG] Download e conversão concluídos via yt-dlp/ffmpeg.");

      if (!fs.existsSync(tempOutput)) {
        console.log("[DEBUG] Falha: arquivo MP3 não gerado.");
        throw new Error("Download/Conversão falhou.");
      }

      console.log("[DEBUG] MP3 gerado com sucesso.");
      await sendSuccessReact();

      console.log("[DEBUG] Enviando arquivo ao usuário…");
      // A função correta para enviar arquivos de áudio é sendAudioFromFile
      const sendAudioFromFile = sendFileReply; // Mantendo a compatibilidade com o nome original
      await sendAudioFromFile(tempOutput, false, true); // false para não ser voice, true para quoted

    } catch (err) {
      console.error("[ERRO] Processo /play falhou:", err);
      return sendErrorReply("Ocorreu um erro ao baixar ou converter o áudio."); // CORRIGIDO: sendTextReply -> sendErrorReply
    } finally {
      console.log("[DEBUG] Limpando arquivos temporários…");
      // O yt-dlp não cria um arquivo temporário intermediário no modo -x, então removemos a limpeza do tempInput.
      // if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    }
  },
};
