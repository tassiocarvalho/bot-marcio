/**
 */
import fs from "node:fs";
import { PREFIX } from "../../config.js";
import { InvalidParameterError } from "../../errors/index.js";
import { Ffmpeg } from "../../services/ffmpeg.js"; // Importando nossa classe
import { getRandomName } from "../../utils/index.js";

export default {
  name: "togif",
  description: "Transforma uma figurinha animada em GIF",
  commands: ["togif", "tovideo", "tovid"],
  usage: `${PREFIX}togif (marque a figurinha animada)`,
  
  handle: async ({
    isSticker,
    downloadSticker,
    webMessage,
    sendWaitReact,
    sendSuccessReact,
    sendVideoFromFile, // Certifique-se que seu bot exporta essa função
    sendErrorReply,
  }) => {
    
    // 1. Validação
    if (!isSticker) {
      throw new InvalidParameterError("Você precisa marcar uma figurinha animada!");
    }

    await sendWaitReact();

    const ffmpegService = new Ffmpeg();
    let inputPath = null;
    let gifPath = null;

    try {
      // 2. Download do Sticker
      inputPath = await downloadSticker(webMessage, getRandomName());

      // 3. Conversão usando a classe Ffmpeg
      // O método convertStickerToGif gera um arquivo .gif real
      gifPath = await ffmpegService.convertStickerToGif(inputPath);

      await sendSuccessReact();

      // 4. Envio
      // Nota: O WhatsApp reproduz melhor se enviarmos como vídeo com gifPlayback: true.
      // Se a função sendVideoFromFile do seu bot aceitar opções, use assim:
      await sendVideoFromFile(gifPath, {
         caption: "Aqui está seu GIF! 🎥",
         gifPlayback: true 
      });

    } catch (error) {
      console.error("Erro no togif:", error);
      await sendErrorReply("Erro ao converter a figurinha. Tente novamente.");
    } finally {
      // 5. Limpeza (Deletar arquivos temporários)
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (gifPath && fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
    }
  },
};