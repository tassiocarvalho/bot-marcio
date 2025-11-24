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
import ytDlp from "yt-dlp-exec";

const exec = promisify(execChild);

export default {
  name: "play",
  description: "Baixa música do YouTube como MP3.",
  commands: ["play"],
  usage: `${PREFIX}play <nome da música>`,

  handle: async (props) => {
    console.log("\n\n===== [DEBUG /play] PROPS RECEBIDOS =====");
    console.log(props);
    console.log("=========================================\n\n");

    // Extração segura dos props
    const {
      args,
      sock,
      msg,
      sendTextReply,
      sendWaitReact,
      sendSuccessReact,
      sendFileReply,
    } = props;

    // DEBUG individual
    console.log("[DEBUG] args:", args);
    console.log("[DEBUG] sock existe?", !!sock);
    console.log("[DEBUG] msg existe?", !!msg);
    console.log("[DEBUG] sendTextReply existe?", !!sendTextReply);
    console.log("[DEBUG] sendWaitReact existe?", !!sendWaitReact);
    console.log("[DEBUG] sendSuccessReact existe?", !!sendSuccessReact);
    console.log("[DEBUG] sendFileReply existe?", !!sendFileReply);

    if (!args || !args.length) {
      console.log("[DEBUG] Nenhum argumento recebido");
      throw new InvalidParameterError("Você precisa informar o nome da música!");
    }

    const query = args.join(" ");
    console.log("[DEBUG] Consulta YT:", query);

    // Testa função (gera erro se estiver undefined)
    try {
      console.log("[DEBUG] Testando sendWaitReact()");
      await sendWaitReact();
    } catch (err) {
      console.log("[ERRO] sendWaitReact FALHOU:", err);
    }

    let info;
    try {
      console.log("[DEBUG] Fazendo busca no yt-search…");
      const search = await yts(query);

      console.log("[DEBUG] Resultados encontrados:", search.videos.length);

      if (!search.videos.length) {
        console.log("[DEBUG] Nenhum vídeo encontrado");
        return sendTextReply("❌ Nenhum resultado encontrado no YouTube.");
      }

      info = search.videos[0];
      console.log("[DEBUG] Vídeo selecionado:", info);
    } catch (e) {
      console.error("[ERRO] yt-search falhou:", e);
      return sendTextReply("❌ Erro ao pesquisar no YouTube.");
    }

    // Mensagem inicial
    try {
      console.log("[DEBUG] Enviando mensagem inicial...");
      await sendTextReply(
        `🎵 *Resultado encontrado:*\n\n` +
          `📌 *Título:* ${info.title}\n` +
          `👤 *Canal:* ${info.author.name}\n` +
          `⏱️ *Duração:* ${info.timestamp}\n` +
          `🔗 https://youtube.com/watch?v=${info.videoId}\n\n` +
          `⏳ Baixando e convertendo para MP3...`
      );
    } catch (err) {
      console.log("[ERRO] sendTextReply falhou:", err);
    }

    const videoUrl = info.url;
    const tempInput = path.join(TEMP_DIR, getRandomName("webm"));
    const tempOutput = path.join(TEMP_DIR, getRandomName("mp3"));

    console.log("[DEBUG] Temp input:", tempInput);
    console.log("[DEBUG] Temp output:", tempOutput);

    try {
      console.log("[DEBUG] Iniciando download via yt-dlp…");

      await ytDlp(videoUrl, {
        output: tempInput,
        extractAudio: false,
        quiet: false,
      });

      console.log("[DEBUG] Download concluído.");

      console.log("[DEBUG] Convertendo para MP3…");
      await exec(`ffmpeg -y -i "${tempInput}" -vn -ab 192k "${tempOutput}"`);

      console.log("[DEBUG] ffmpeg terminou.");

      if (!fs.existsSync(tempOutput)) {
        throw new Error("Conversão falhou (arquivo não existe).");
      }

      console.log("[DEBUG] Enviando reação de sucesso");
      await sendSuccessReact();

      console.log("[DEBUG] Enviando arquivo MP3...");
      await sendFileReply(tempOutput, `${info.title}.mp3`);

      console.log("[DEBUG] MP3 enviado com sucesso!");
    } catch (err) {
      console.error("[ERRO] Processo /play falhou:", err);
      return sendTextReply("❌ Ocorreu um erro ao baixar ou converter o áudio.");
    } finally {
      console.log("[DEBUG] Limpando arquivos temporários…");

      if (fs.existsSync(tempInput)) {
        fs.unlinkSync(tempInput);
        console.log("[DEBUG] tempInput apagado");
      }
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput);
        console.log("[DEBUG] tempOutput apagado");
      }
    }
  },
};
