import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { SpiderXApi } from "../../../services/spider-x-api.js";
import { Ffmpeg } from "../../../services/ffmpeg.js";
import ytdl from "ytdl-core";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "../../../config.js";
import { unlink } from "node:fs/promises";

export default {
  //name: "play",
  description: "Pesquisa e envia o áudio de um vídeo do YouTube",
  //commands: ["play", "pa"],
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

    const spiderXApi = new SpiderXApi();
    const ffmpeg = new Ffmpeg();
    let tempWebmPath = null;
    let finalMp3Path = null;

    try {
      // 1. Busca o vídeo usando a Spider X API (para evitar bloqueio de IP)
      const searchResults = await spiderXApi.youtubeSearch(fullArgs);

      if (!searchResults.length) {
        throw new WarningError("Nenhum vídeo encontrado para sua pesquisa.");
      }

      const firstVideo = searchResults[0];
      const videoUrl = firstVideo.url;
      const videoId = firstVideo.url.split("v=")[1];

      // 2. Exibir as informações do vídeo antes de baixar
      const infoMessage = `
*Vídeo Encontrado:*

*Título:* ${firstVideo.title}
*Canal:* ${firstVideo.author}
*Duração:* ${firstVideo.duration}
*Views:* ${firstVideo.views}
*Link:* ${videoUrl}

*Iniciando download e conversão para MP3...*
`;
      await sendReply(infoMessage);

      // 3. Baixar o áudio usando ytdl-core (mais simples e sem cookies)
      tempWebmPath = path.join(TEMP_DIR, `${videoId}_temp.webm`);

      const stream = ytdl(videoUrl, {
        quality: 'highestaudio',
        filter: 'audioonly'
      });

      const fileStream = createWriteStream(tempWebmPath);

      await new Promise((resolve, reject) => {
        stream.pipe(fileStream);
        stream.on("error", reject);
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
      });

      // 4. Converter o arquivo temporário para MP3 usando FFmpeg
      finalMp3Path = await ffmpeg.convertToMp3(tempWebmPath);

      // 5. Enviar o MP3 final
      await sendAudioFromFile(finalMp3Path, true, true);
      await sendSuccessReact();
    } catch (error) {
      console.error("Erro no comando /play (ytdl-core + FFmpeg):", error);
      
      let errorMessage = "Ocorreu um erro ao processar sua solicitação de áudio.";
      
      if (error.message.includes("FFmpeg not found") || error.message.includes("FFmpeg failed")) {
          errorMessage = `❌ Erro de Conversão: ${error.message}. Verifique se o FFmpeg está instalado corretamente.`;
      } else if (error.message.includes("status code 403") || error.message.includes("status code 410")) {
          errorMessage = `❌ Erro de Download: O vídeo está bloqueado, privado ou indisponível.`;
      } else if (error instanceof WarningError) {
          throw error; // Propaga erros amigáveis da Spider X API
      } else {
          errorMessage = `❌ Erro Desconhecido: ${error.message}`;
      }
      
      throw new WarningError(errorMessage);
    } finally {
      // 6. Limpar arquivos temporários
      try {
        if (tempWebmPath) await unlink(tempWebmPath);
        if (finalMp3Path) await unlink(finalMp3Path);
      } catch (e) {
        console.error("Erro ao deletar arquivos temporários:", e);
      }
    }
  },
};
