/**
 * Desenvolvido por: Dev Gui
 * Módulo Fig10 - Versão Estável (Corte -> Conversão)
 */
import fs from "node:fs";
import { BOT_EMOJI, BOT_NAME, PREFIX } from "../../config.js";
import { InvalidParameterError } from "../../errors/index.js";
import { Ffmpeg } from "../../services/ffmpeg.js";
import { addStickerMetadata } from "../../services/sticker.js";
import { getRandomName } from "../../utils/index.js";

export default {
  name: "fig10",
  description: "Cria figurinhas de vídeos longos (até 60s), dividindo em partes.",
  commands: ["fig10", "sticker10", "s10"],
  usage: `${PREFIX}fig10 (marque ou responda um vídeo)`,
  handle: async ({
    isVideo,
    downloadVideo,
    webMessage,
    sendErrorReply,
    sendWaitReact,
    sendSuccessReact,
    sendStickerFromFile,
    userLid,
  }) => {
    
    if (!isVideo) {
      throw new InvalidParameterError("Este comando serve apenas para vídeos/GIFs!");
    }

    const videoSeconds =
      webMessage.message?.videoMessage?.seconds ||
      webMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.seconds || 
      0;

    if (videoSeconds > 60) {
      return sendErrorReply("O vídeo é muito longo! O limite máximo é 60 segundos.");
    }

    await sendWaitReact();

    const username = webMessage.pushName || webMessage.notifyName || userLid.replace(/@lid/, "");
    const ffmpegService = new Ffmpeg();
    let inputPath = null;
    
    // Arrays para limpeza posterior
    const tempFilesToDelete = [];

    try {
      inputPath = await downloadVideo(webMessage, getRandomName());
      tempFilesToDelete.push(inputPath);

      const CHUNK_DURATION = 8.5; 
      const totalParts = Math.ceil(videoSeconds / CHUNK_DURATION);
      const finalParts = totalParts > 0 ? totalParts : 1;

      for (let i = 0; i < finalParts; i++) {
        const startTime = i * CHUNK_DURATION;
        
        // --- PASSO 1: CORTAR O VÍDEO ---
        // Gera um arquivo .mp4 pequeno e perfeito
        const cutPath = await ffmpegService.cutVideo(inputPath, startTime, CHUNK_DURATION);
        tempFilesToDelete.push(cutPath);

        // --- PASSO 2: CONVERTER O CORTE PARA STICKER ---
        // O createSticker agora recebe um vídeo que já começa no tempo 0
        const stickerPath = await ffmpegService.createSticker(cutPath, true);
        tempFilesToDelete.push(stickerPath);

        // --- PASSO 3: METADADOS E ENVIO ---
        const metadata = {
          username: username,
          botName: `${BOT_EMOJI} ${BOT_NAME} (${i + 1}/${finalParts})`,
        };

        const stickerBuffer = await fs.promises.readFile(stickerPath);
        const stickerWithMeta = await addStickerMetadata(stickerBuffer, metadata);
        
        const finalStickerPath = stickerPath + ".tmp.webp";
        fs.writeFileSync(finalStickerPath, stickerWithMeta);
        tempFilesToDelete.push(finalStickerPath);

        await sendStickerFromFile(finalStickerPath);
        
        // Pausa leve para o WhatsApp processar a ordem
        await new Promise(r => setTimeout(r, 1500));
      }

      await sendSuccessReact();

    } catch (error) {
      console.error("Erro no fig10:", error);
      await sendErrorReply("Erro ao processar o vídeo longo.");
    } finally {
      // Limpeza robusta de todos os arquivos gerados
      tempFilesToDelete.forEach(path => {
        if (fs.existsSync(path)) fs.unlinkSync(path);
      });
    }
  },
};