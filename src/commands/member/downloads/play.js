import ytdl from "ytdl-core";
import ytSearch from "yt-search";
import fs from "fs";
import path from "path";
import { Ffmpeg } from "../services/ffmpeg.js"; // sua classe
import { getRandomNumber } from "../utils/index.js";

const ffmpeg = new Ffmpeg();

export default {
  name: "play",
  description: "Baixa músicas do YouTube",
  commands: ["play"],
  usage: "/play nome da música",

  /**
   * @param {CommandHandleProps} props
   */
  async handle({ message, args, client }) {
    try {
      if (!args.length) {
        return message.reply("Digite algo para pesquisar. Exemplo:\n/play faded");
      }

      const query = args.join(" ");

      await message.reply("🎵 Procurando música...");

      // 1️⃣ PESQUISA NO YOUTUBE (SEM LOGIN)
      const result = await ytSearch(query);
      if (!result || !result.videos || result.videos.length === 0) {
        return message.reply("Nenhum vídeo encontrado.");
      }

      const video = result.videos[0]; // pegar o primeiro

      // 2️⃣ Enviar detalhes do vídeo
      await message.reply(
        `🎧 *Resultado encontrado:*\n\n` +
          `📌 *Título:* ${video.title}\n` +
          `📀 *Canal:* ${video.author.name}\n` +
          `⏱ *Duração:* ${video.timestamp}\n` +
          `👀 *Views:* ${video.views}\n\n` +
          `🔗 ${video.url}\n\n` +
          `🎶 Baixando o áudio...`
      );

      // 3️⃣ Caminho temporário
      const tempInput = path.join(
        ffmpeg.tempDir,
        `${getRandomNumber(10000, 99999)}.webm`
      );

      const tempOutputMp3 = path.join(
        ffmpeg.tempDir,
        `${getRandomNumber(10000, 99999)}.mp3`
      );

      // 4️⃣ BAIXA O ÁUDIO EM FORMATO WEBM
      const audio = ytdl(video.url, {
        filter: "audioonly",
        quality: "highestaudio",
      });

      // Salvar o arquivo WEBM temporário
      const writeStream = fs.createWriteStream(tempInput);
      audio.pipe(writeStream);

      await new Promise((resolve, reject) => {
        audio.on("end", resolve);
        audio.on("error", reject);
      });

      // 5️⃣ CONVERTER PARA MP3
      const mp3Path = await ffmpeg.convertToMp3(tempInput);

      // 6️⃣ ENVIAR PARA O USUÁRIO
      await client.sendMessage(message.from, {
        audio: {
          url: mp3Path,
        },
        mimetype: "audio/mpeg",
      });

      // 7️⃣ LIMPAR ARQUIVOS
      fs.unlinkSync(tempInput);
      fs.unlinkSync(mp3Path);

      return;

    } catch (err) {
      console.error(err);
      return message.reply("❌ Ocorreu um erro ao tentar processar o áudio.");
    }
  },
};
