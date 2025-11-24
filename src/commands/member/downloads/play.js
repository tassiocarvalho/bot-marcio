import TelegramBot from "node-telegram-bot-api";
import ytSearch from "yt-search";
import ytdl from "yt-dlp-exec";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "node:path";

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/play (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1];

  try {
    // 1) =============== BUSCAR VÍDEO ===============
    const search = await ytSearch(query);
    const video = search.videos[0];
    if (!video) return bot.sendMessage(chatId, "Nenhum resultado encontrado.");

    const videoUrl = video.url;

    // 2) =============== PRIMEIRA MENSAGEM (INFORMAÇÕES) ===============
    await bot.sendPhoto(chatId, video.thumbnail, {
      caption: `🎵 *${video.title}*\n\n👤 Canal: *${video.author.name}*\n⏱ Duração: *${video.timestamp}*\n🔗 ${videoUrl}`,
      parse_mode: "Markdown",
    });

    // 3) =============== DOWNLOAD DO ÁUDIO ===============
    const outputMp3 = path.resolve(`./temp-${Date.now()}.mp3`);

    const tempAudio = path.resolve(`./raw-${Date.now()}.m4a`);

    // Baixa somente o áudio com yt-dlp
    await ytdl(videoUrl, {
      extractAudio: false,
      audioFormat: "m4a",
      output: tempAudio
    });

    // 4) =============== CONVERTER PARA MP3 ===============
    await new Promise((resolve, reject) => {
      ffmpeg(tempAudio)
        .toFormat("mp3")
        .on("end", resolve)
        .on("error", reject)
        .save(outputMp3);
    });

    fs.unlinkSync(tempAudio);

    // 5) =============== SEGUNDA MENSAGEM (O ÁUDIO MP3) ===============
    await bot.sendAudio(chatId, outputMp3, {
      title: video.title,
      performer: video.author.name,
    });

    fs.unlinkSync(outputMp3);

  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "Erro ao processar o comando.");
  }
});
