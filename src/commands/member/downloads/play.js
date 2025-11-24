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
  description: "Baixa música do YouTube e envia como MP3.",
  commands: ["play"],
  usage: `${PREFIX}play <nome da música>`,

  handle: async ({ sock, msg, args }) => {
    // === Verificação ===
    if (!args || !args.length) {
      throw new InvalidParameterError("Você precisa informar o nome da música!");
    }

    const query = args.join(" ");

    // Reação de carregando
    await sock.sendMessage(msg.from, { react: { text: "⏳", key: msg.key } });

    let info;
    try {
      const search = await yts(query);

      if (!search.videos.length) {
        return sock.sendMessage(msg.from, {
          text: "❌ Nenhum resultado encontrado no YouTube."
        });
      }

      info = search.videos[0];
    } catch (e) {
      console.error(e);
      return sock.sendMessage(msg.from, {
        text: "❌ Erro ao pesquisar no YouTube."
      });
    }

    // Envia mensagem com a prévia
    await sock.sendMessage(msg.from, {
      text:
        `🎵 *Resultado encontrado:*\n\n` +
        `📌 *Título:* ${info.title}\n` +
        `👤 *Canal:* ${info.author.name}\n` +
        `⏱️ *Duração:* ${info.timestamp}\n` +
        `🔗 https://youtube.com/watch?v=${info.videoId}\n\n` +
        `⏳ Baixando e convertendo para MP3...`
    });

    const videoUrl = info.url;
    const tempInput = path.join(TEMP_DIR, getRandomName("webm"));
    const tempOutput = path.join(TEMP_DIR, getRandomName("mp3"));

    try {
      // === 1) Baixa o áudio com yt-dlp
      await ytDlp(videoUrl, {
        output: tempInput,
        extractAudio: false,
        quiet: true,
      });

      // === 2) Converte para MP3 via FFmpeg
      await exec(`ffmpeg -y -i "${tempInput}" -vn -ab 192k "${tempOutput}"`);

      if (!fs.existsSync(tempOutput)) {
        throw new Error("Falha na conversão.");
      }

      // Reação de sucesso
      await sock.sendMessage(msg.from, {
        react: { text: "✅", key: msg.key }
      });

      // === 3) Envia arquivo MP3
      await sock.sendMessage(msg.from, {
        document: fs.readFileSync(tempOutput),
        mimetype: "audio/mpeg",
        fileName: `${info.title}.mp3`
      });
    } catch (err) {
      console.error("Erro em /play:", err);

      return sock.sendMessage(msg.from, {
        text: "❌ Ocorreu um erro ao baixar ou converter o áudio."
      });

    } finally {
      // Limpa arquivos temporários
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    }
  },
};
