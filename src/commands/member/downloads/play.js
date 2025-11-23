import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { Innertube } from "youtubei.js";
import { Writable } from "node:stream";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { TEMP_DIR } from "../../../config.js";

export default {
  name: "play-new",
  description: "Pesquisa e envia o áudio de um vídeo do YouTube",
  commands: ["play"],
  usage: `${PREFIX}play galinha pintadinha`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    fullArgs,
    sendReply,
    sendWaitReact,
    sendSuccessReact,
    sendAudioFromFile,
    sendErrorReply,
  }) => {
    if (!fullArgs.length) {
      throw new InvalidParameterError(
        "Você precisa me dizer o que deseja buscar!"
      );
    }

    await sendWaitReact();

    let innertube;
    try {
      innertube = await Innertube.create();
    } catch (error) {
      console.error("Erro ao criar Innertube:", error);
      throw new WarningError("Não foi possível conectar ao YouTube. Tente novamente mais tarde.");
    }

    let video;
    try {
      const searchResults = await innertube.search(fullArgs, {
        type: "video",
      });

      if (!searchResults.videos.length) {
        throw new WarningError("Nenhum vídeo encontrado para sua pesquisa.");
      }

      video = searchResults.videos[0];
    } catch (error) {
      console.error("Erro ao buscar vídeo:", error);
      throw new WarningError("Ocorreu um erro ao buscar o vídeo no YouTube.");
    }

    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
    const audioPath = path.join(TEMP_DIR, `${video.id}.mp3` );

    const infoMessage = `
*Vídeo Encontrado:*

*Título:* ${video.title}
*Canal:* ${video.author.name}
*Duração:* ${video.duration.text}
*Views:* ${video.views.text}
*Link:* ${videoUrl}

*Iniciando download e conversão para MP3...*
`;

    await sendReply(infoMessage);

    try {
      const stream = await innertube.download(video.id, {
        type: "audio",
        quality: "best",
      });

      const writable = new Writable({
        write(chunk, encoding, callback) {
          fileStream.write(chunk, callback);
        },
      });

      const fileStream = createWriteStream(audioPath);

      await new Promise((resolve, reject) => {
        stream.pipe(fileStream);
        stream.on("error", reject);
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
      });

      await sendAudioFromFile(audioPath, true, true);
      await sendSuccessReact();
    } catch (error) {
      console.error("Erro ao baixar/enviar áudio:", error);
      await sendErrorReply("Ocorreu um erro ao baixar ou enviar o áudio.");
    } finally {
      try {
        await unlink(audioPath);
      } catch (e) {
        console.error("Erro ao deletar arquivo temporário:", e);
      }
    }
  },
};
