/**
 * Desenvolvido por: Dev Gui
 * Módulo Fig10 - Versão Sharp (Correção de Figurinha Corrompida)
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
    const tempFiles = [];

    try {
      inputPath = await downloadVideo(webMessage, getRandomName());
      tempFiles.push(inputPath);

      // Duração de cada figurinha
      const CHUNK_DURATION = 8.0; 
      const totalParts = Math.ceil(videoSeconds / CHUNK_DURATION);
      const finalParts = totalParts > 0 ? totalParts : 1;

      for (let i = 0; i < finalParts; i++) {
        const startTime = i * CHUNK_DURATION;
        
        // --- A MÁGICA ---
        // Chama a função nova que usa FFmpeg (Corte) + Sharp (Conversão)
        // Isso retorna o caminho de um .webp válido e não corrompido
        const stickerPath = await ffmpegService.cutVideoToWebP(inputPath, startTime, CHUNK_DURATION);
        tempFiles.push(stickerPath);

        // Adiciona Metadados
        const metadata = {
          username: username,
          botName: `${BOT_EMOJI} ${BOT_NAME} (${i + 1}/${finalParts})`,
        };

        const stickerBuffer = await fs.promises.readFile(stickerPath);
        const stickerWithMeta = await addStickerMetadata(stickerBuffer, metadata);
        
        const finalStickerPath = stickerPath + ".final.webp";
        fs.writeFileSync(finalStickerPath, stickerWithMeta);
        tempFiles.push(finalStickerPath);

        // Envia
        await sendStickerFromFile(finalStickerPath);
        
        // Pausa de segurança para o WhatsApp não inverter a ordem
        await new Promise(r => setTimeout(r, 1500));
      }

      await sendSuccessReact();

    } catch (error) {
      console.error("Erro no fig10:", error);
      await sendErrorReply("Erro ao processar o vídeo. Tente um vídeo mais curto ou leve.");
    } finally {
      // Limpeza
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      tempFiles.forEach(path => {
        if (fs.existsSync(path)) fs.unlinkSync(path);
      });
    }
  },
};