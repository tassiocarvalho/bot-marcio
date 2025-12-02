/**
 * Desenvolvido por: Dev Gui
 * Módulo de conversão de Sticker para GIF (Corrigido)
 */
import fs from "node:fs";
import { PREFIX } from "../../config.js";
import { InvalidParameterError } from "../../errors/index.js";
import { Ffmpeg } from "../../services/ffmpeg.js"; 
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
    sendVideoFromFile, 
    sendErrorReply,
  }) => {
    
    if (!isSticker) {
      throw new InvalidParameterError("Você precisa marcar uma figurinha animada!");
    }

    await sendWaitReact();

    const ffmpegService = new Ffmpeg();
    let inputPath = null;
    let gifPath = null;

    try {
      inputPath = await downloadSticker(webMessage, getRandomName());

      // Converte usando o método que criamos (Sharp -> MP4)
      gifPath = await ffmpegService.convertStickerToGif(inputPath);

      await sendSuccessReact();

      // CORREÇÃO AQUI:
      // Passamos apenas o caminho do arquivo e uma legenda em texto simples.
      // Removemos o objeto { gifPlayback: true } que causava o [object Object].
      await sendVideoFromFile(gifPath, "Aqui está seu GIF! 🎥");

    } catch (error) {
      console.error("Erro no togif:", error);
      await sendErrorReply("Erro ao converter a figurinha. Tente novamente.");
    } finally {
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (gifPath && fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
    }
  },
};