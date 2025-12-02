/**
 * Desenvolvido por: Dev Gui
 * Módulo Fig10 - Corta vídeos longos em várias figurinhas
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
    
    // 1. Validação básica
    if (!isVideo) {
      throw new InvalidParameterError("Este comando serve apenas para vídeos/GIFs!");
    }

    // 2. Obter a duração do vídeo (Metadados do WhatsApp)
    const videoSeconds =
      webMessage.message?.videoMessage?.seconds ||
      webMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.seconds || 
      0;

    // Regra: Se passar de 59.5s, recusa.
    if (videoSeconds > 59.5) {
      return sendErrorReply("O vídeo é muito longo! O limite máximo é 60 segundos.");
    }

    await sendWaitReact();

    const username = webMessage.pushName || webMessage.notifyName || userLid.replace(/@lid/, "");
    const ffmpegService = new Ffmpeg();
    let inputPath = null;
    
    // Lista para guardar os caminhos das figurinhas geradas para limpar depois
    const createdStickers = [];

    try {
      // 3. Download do Vídeo
      inputPath = await downloadVideo(webMessage, getRandomName());

      // 4. Lógica de Divisão
      const CHUNK_DURATION = 8.5; // Tamanho de cada corte
      const totalParts = Math.ceil(videoSeconds / CHUNK_DURATION);

      // Se o vídeo for muito curto (menos que 8.5s), trata como 1 parte
      const finalParts = totalParts > 0 ? totalParts : 1;

      // Loop para criar e enviar cada parte
      for (let i = 0; i < finalParts; i++) {
        const startTime = i * CHUNK_DURATION;
        
        // --- Criação ---
        // Chama o método atualizado passando o tempo de início e duração
        const stickerPath = await ffmpegService.createSticker(
          inputPath, 
          true,        // isVideo
          startTime,   // start
          CHUNK_DURATION // duration
        );
        
        createdStickers.push(stickerPath);

        // --- Metadados ---
        // Personaliza o pacote: "Nome do Bot (1/4)"
        const metadata = {
          username: username,
          botName: `${BOT_EMOJI} ${BOT_NAME} (${i + 1}/${finalParts})`,
        };

        const stickerBuffer = await fs.promises.readFile(stickerPath);
        const stickerWithMeta = await addStickerMetadata(stickerBuffer, metadata);
        
        // Salvamos o arquivo final temporário
        const finalStickerPath = stickerPath + ".tmp.webp";
        fs.writeFileSync(finalStickerPath, stickerWithMeta);
        createdStickers.push(finalStickerPath);

        // --- Envio ---
        await sendStickerFromFile(finalStickerPath);
        
        // Pequena pausa para garantir a ordem de envio no WhatsApp
        await new Promise(r => setTimeout(r, 1000));
      }

      await sendSuccessReact();

    } catch (error) {
      console.error("Erro no fig10:", error);
      await sendErrorReply("Erro ao processar o vídeo longo.");
    } finally {
      // 5. Limpeza Geral
      if (inputPath && fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      // Deleta todas as figurinhas temporárias criadas no loop
      createdStickers.forEach(path => {
        if (fs.existsSync(path)) fs.unlinkSync(path);
      });
    }
  },
};