import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { Innertube } from "youtubei.js";
import { Writable } from "node:stream";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { TEMP_DIR } from "../../../config.js";
import { Ffmpeg } from "../../../services/ffmpeg.js";
import fs from "node:fs";

// Função auxiliar para ler cookies
// Função auxiliar para ler cookies
function getYoutubeCookies() {
  const cookiesPath = path.resolve(process.cwd(), "database", "youtube_cookies.json");
  if (fs.existsSync(cookiesPath)) {
    try {
      // Lê o conteúdo como texto puro, remove espaços em branco e quebras de linha
      let cookies = fs.readFileSync(cookiesPath, "utf-8").trim();
      
      // CORREÇÃO: Remove as aspas externas se o formato for JSON String
      if (cookies.startsWith('"') && cookies.endsWith('"')) {
          cookies = cookies.substring(1, cookies.length - 1);
      }
      
      // Verifica se o arquivo não está vazio
      if (cookies.length > 0) {
        return cookies;
      }
    } catch (e) {
      console.error("Erro ao ler youtube_cookies.json:", e);
      return null;
    }
  }
  return null;
}

export default {
  name: "play",
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
      const cookieString = getYoutubeCookies();
      const options = cookieString ? { cookie: cookieString } : {};
      
      innertube = await Innertube.create(options);
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
      // Exibir o erro exato da busca
      throw new WarningError(`Ocorreu um erro ao buscar o vídeo no YouTube. Detalhes: ${error.message}`);
    }

    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
    const tempWebmPath = path.join(TEMP_DIR, `${video.id}_temp.webm` );
    let finalMp3Path = null;
    const ffmpeg = new Ffmpeg();

    const infoMessage = `
*Vídeo Encontrado:*

*Título:* ${video.title}
*Canal:* ${video.author.name}
*Duração:* ${video.duration?.text || 'N/A'}
*Views:* ${video.views?.text || 'N/A'}
*Link:* ${videoUrl}

*Iniciando download e conversão para MP3...*
`;

    await sendReply(infoMessage);

    try {
      // 1. Baixar o stream de áudio para um arquivo temporário (webm/m4a)
      const stream = await innertube.download(video.id, {
        type: "audio",
        quality: "best",
      });

      const fileStream = createWriteStream(tempWebmPath);

      await new Promise((resolve, reject) => {
        stream.pipe(fileStream);
        stream.on("error", reject);
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
      });

      // 2. Converter o arquivo temporário para MP3 usando FFmpeg
      finalMp3Path = await ffmpeg.convertToMp3(tempWebmPath);

      // 3. Enviar o MP3 final
      await sendAudioFromFile(finalMp3Path, true, true);
      await sendSuccessReact();
    } catch (error) {
      console.error("Erro ao baixar/converter/enviar áudio:", error);
      // Propaga o erro exato do FFmpeg ou da operação de download
      throw new WarningError(`Ocorreu um erro ao baixar, converter ou enviar o áudio. Detalhes: ${error.message}`);
    } finally {
      // 4. Limpar arquivos temporários
      try {
        await ffmpeg.cleanup(tempWebmPath);
        if (finalMp3Path) {
          await ffmpeg.cleanup(finalMp3Path);
        }
      } catch (e) {
        console.error("Erro ao deletar arquivos temporários:", e);
      }
    }
  },
};
