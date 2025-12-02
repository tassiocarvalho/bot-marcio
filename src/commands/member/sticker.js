/**
 * Desenvolvido por: Dev Gui
 * Refatorado para usar serviço Ffmpeg por: Gemini
 *
 * @author Dev Gui
 */
import fs from "node:fs";
import path from "node:path";
import { BOT_EMOJI, BOT_NAME, PREFIX, TEMP_DIR } from "../../config.js";
import { InvalidParameterError } from "../../errors/index.js";
import { addStickerMetadata } from "../../services/sticker.js";
import { getRandomName } from "../../utils/index.js";

// 1. IMPORTANTE: Importe a sua classe Ffmpeg aqui
// Verifique se o caminho "../services/ffmpeg.js" está correto para sua estrutura
import { Ffmpeg } from "../../services/ffmpeg.js"; 

export default {
  name: "sticker",
  description: "Cria figurinhas de imagem, gif ou vídeo (máximo 10 segundos).",
  commands: ["f", "s", "sticker", "fig"],
  usage: `${PREFIX}sticker (marque ou responda uma imagem/gif/vídeo)`,
  handle: async ({
    isImage,
    isVideo,
    downloadImage,
    downloadVideo,
    webMessage,
    sendErrorReply,
    sendWaitReact,
    sendSuccessReact,
    sendStickerFromFile,
    userLid,
  }) => {
    if (!isImage && !isVideo) {
      throw new InvalidParameterError(
        `Você precisa marcar ou responder a uma imagem/gif/vídeo!`
      );
    }

    await sendWaitReact();

    const username =
      webMessage.pushName ||
      webMessage.notifyName ||
      userLid.replace(/@lid/, "");

    const metadata = {
      username: username,
      botName: `${BOT_EMOJI} ${BOT_NAME}`,
    };

    // Instancia o serviço de FFmpeg
    const ffmpegService = new Ffmpeg();
    
    let inputPath = null;
    let stickerPath = null;
    let finalStickerWithMetadata = null;

    try {
      // --- BLOCO DE DOWNLOAD (Mantém a lógica de tentativas) ---
      if (isImage) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            inputPath = await downloadImage(webMessage, getRandomName());
            break;
          } catch (downloadError) {
            console.error(`Tentativa ${attempt} download imagem falhou:`, downloadError.message);
            if (attempt === 3) throw new Error("Falha ao baixar imagem.");
            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          }
        }
      } else {
        // Lógica de Vídeo
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            inputPath = await downloadVideo(webMessage, getRandomName());
            break;
          } catch (downloadError) {
            console.error(`Tentativa ${attempt} download vídeo falhou:`, downloadError.message);
            if (attempt === 3) throw new Error("Falha ao baixar vídeo.");
            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          }
        }

        const maxDuration = 10;
        const seconds =
          webMessage.message?.videoMessage?.seconds ||
          webMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.seconds;

        if (!seconds || seconds > maxDuration) {
           if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
           return sendErrorReply(`O vídeo deve ter no máximo ${maxDuration} segundos.`);
        }
      }

      // --- AQUI ESTÁ A MUDANÇA PRINCIPAL ---
      // Em vez de rodar execChild com comandos gigantes, chamamos o serviço:
      
      // O segundo parâmetro 'isVideo' ativa a otimização que evita o corte do vídeo
      stickerPath = await ffmpegService.createSticker(inputPath, isVideo);

      // Limpa o arquivo de entrada original (download) pois o FFmpeg já criou o WebP
      if (inputPath && fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
        inputPath = null;
      }

      // Adiciona metadados (Exif)
      const stickerBuffer = await fs.promises.readFile(stickerPath);
      finalStickerWithMetadata = await addStickerMetadata(stickerBuffer, metadata);

      // Envia a figurinha
      await sendSuccessReact();
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sendStickerFromFile(finalStickerWithMetadata);
          break;
        } catch (stickerError) {
           console.error(`Tentativa ${attempt} envio falhou.`);
           if (attempt === 3) throw new Error("Erro ao enviar figurinha.");
           await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

    } catch (error) {
      console.error("Erro detalhado no comando sticker:", error);
      
      // Mensagens de erro amigáveis
      if (error.message.includes("FFmpeg")) {
         return sendErrorReply("Erro ao processar a mídia. O arquivo pode estar corrompido.");
      }
      if (error.message.includes("ETIMEDOUT") || error.message.includes("ECONNREFUSED")) {
         return sendErrorReply("Erro de conexão. Tente novamente.");
      }

      throw new Error(`Erro ao processar sticker: ${error.message}`);
      
    } finally {
      // --- LIMPEZA DE ARQUIVOS ---
      // Limpa input se sobrou
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      
      // Limpa o webp temporário gerado pelo ffmpeg
      if (stickerPath && fs.existsSync(stickerPath)) fs.unlinkSync(stickerPath);
      
      // Limpa o arquivo final com metadados
      if (finalStickerWithMetadata && fs.existsSync(finalStickerWithMetadata)) {
        fs.unlinkSync(finalStickerWithMetadata);
      }
    }
  },
};