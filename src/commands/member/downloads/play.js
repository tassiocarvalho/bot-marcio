import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { SpiderXApi } from "../../../services/spider-x-api.js";
import { Ffmpeg } from "../../../services/ffmpeg.js";
import { unlink } from "node:fs/promises";

export default {
  name: "play",
  description: "Pesquisa e envia o áudio de um vídeo do YouTube",
  commands: ["play", "pa"],
  usage: `${PREFIX}play galinha pintadinha`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    fullArgs,
    sendReply,
    sendWaitReact,
    sendSuccessReact,
    sendAudioFromUrl,
    sendErrorReply,
  }) => {
    if (!fullArgs.length) {
      throw new InvalidParameterError(
        "Você precisa me dizer o que deseja buscar!"
      );
    }

    await sendWaitReact();

    const spiderXApi = new SpiderXApi();
    let audioUrl = null;
    let videoInfo = null;

    try {
      // 1. Busca o vídeo
      const searchResults = await spiderXApi.youtubeSearch(fullArgs);

      if (!searchResults.length) {
        throw new WarningError("Nenhum vídeo encontrado para sua pesquisa.");
      }

      const firstVideo = searchResults[0];
      videoInfo = firstVideo;

      // 2. Exibir as informações do vídeo antes de baixar
      const infoMessage = `
*Vídeo Encontrado:*

*Título:* ${firstVideo.title}
*Canal:* ${firstVideo.author}
*Duração:* ${firstVideo.duration}
*Views:* ${firstVideo.views}
*Link:* ${firstVideo.url}

*Iniciando download e envio do áudio...*
`;
      await sendReply(infoMessage);

      // 3. Baixar o áudio
      // A Spider X API já retorna o link direto para o áudio (geralmente MP3 ou compatível)
      const downloadResult = await spiderXApi.youtubeDownload(firstVideo.url, "audio");
      audioUrl = downloadResult.url;

      if (!audioUrl) {
        throw new WarningError("Não foi possível obter o link de download do áudio.");
      }

      // 4. Enviar o áudio
      // sendAudioFromUrl é usado pois a Spider X API retorna uma URL direta
      await sendAudioFromUrl(audioUrl, true, true);
      await sendSuccessReact();
    } catch (error) {
      console.error("Erro no comando /play (Spider X API):", error);
      // Se o erro for um WarningError, ele já tem a mensagem amigável
      if (error instanceof WarningError) {
        throw error;
      }
      // Caso contrário, um erro genérico
      throw new WarningError("Ocorreu um erro ao processar sua solicitação de áudio. Tente novamente mais tarde.");
    }
  },
};
