import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { Innertube } from "youtubei.js";
import ytdl from "ytdl-core";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "../../../config.js";
import { Ffmpeg } from "../../../services/ffmpeg.js";
import fs from "node:fs";

// Função para baixar com ytdl-core (100% JavaScript)
async function downloadWithYtdlCore(videoId, outputPath) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  return new Promise((resolve, reject) => {
    try {
      const stream = ytdl(videoUrl, {
        quality: 'highestaudio',
        filter: 'audioonly'
      });

      const fileStream = createWriteStream(outputPath);

      stream.pipe(fileStream);

      stream.on('error', (err) => {
        console.error('Erro no ytdl stream:', err);
        reject(err);
      });

      fileStream.on('finish', () => {
        console.log('Download ytdl-core concluído');
        resolve(true);
      });

      fileStream.on('error', (err) => {
        console.error('Erro ao escrever arquivo:', err);
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

export default {
  name: "play",
  description: "Pesquisa e envia o áudio de um vídeo do YouTube",
  commands: ["play"],
  usage: `${PREFIX}play galinha pintadinha`,

  handle: async ({ 
    fullArgs, 
    sendReply, 
    sendWaitReact, 
    sendSuccessReact, 
    sendAudioFromFile, 
    sendErrorReply 
  }) => {
    if (!fullArgs.length) {
      throw new InvalidParameterError(
        "Você precisa me dizer o que deseja buscar!"
      );
    }

    await sendWaitReact();

    let innertube;
    try {
      innertube = await Innertube.create({});
    } catch (error) {
      console.error("Erro ao criar Innertube:", error);
      throw new WarningError(
        "Não foi possível conectar ao YouTube. Tente novamente mais tarde."
      );
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
    const tempAudioPath = path.join(TEMP_DIR, `${video.id}_temp.webm`);
    const ytdlTempPath = path.join(TEMP_DIR, `${video.id}_ytdl.webm`);
    let finalAudioPath = null;
    const ffmpeg = new Ffmpeg();

    const infoMessage = `
*Vídeo Encontrado:*
*Título:* ${video.title}
*Canal:* ${video.author.name}
*Duração:* ${video.duration?.text || 'N/A'}
*Views:* ${video.views?.text || 'N/A'}
*Link:* ${videoUrl}

*Iniciando download...*
    `;
    
    await sendReply(infoMessage);

    let downloadMethod = "innertube";
    
    try {
      // MÉTODO 1: Tentar com Innertube primeiro
      try {
        console.log("Tentando download com Innertube...");
        
        const videoInfo = await innertube.getInfo(video.id);
        
        if (videoInfo.basic_info.is_age_restricted) {
          throw new Error("age_restricted");
        }

        const audioFormat = videoInfo.chooseFormat({
          type: 'audio',
          quality: 'best'
        });

        if (!audioFormat) {
          throw new Error("no_audio_format");
        }

        const stream = await innertube.download(video.id, {
          format: audioFormat
        });

        const fileStream = createWriteStream(tempAudioPath);

        await new Promise((resolve, reject) => {
          stream.pipe(fileStream);
          stream.on("error", reject);
          fileStream.on("finish", resolve);
          fileStream.on("error", reject);
        });

        const stats = fs.statSync(tempAudioPath);
        if (stats.size === 0) {
          throw new Error("empty_file");
        }

        console.log(`Download Innertube concluído: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        // Converter para MP3/M4A
        const result = await ffmpeg.convertAudio(tempAudioPath);
        finalAudioPath = result.path;
        
        console.log(`Conversão concluída: ${result.format.toUpperCase()}`);

      } catch (innertubeError) {
        console.log(`Innertube falhou: ${innertubeError.message}`);
        
        // MÉTODO 2: Fallback para ytdl-core (100% JavaScript)
        console.log("Tentando download com ytdl-core...");
        downloadMethod = "ytdl-core";
        
        await sendReply("_Usando método alternativo de download..._");
        
        try {
          await downloadWithYtdlCore(video.id, ytdlTempPath);
          
          const stats = fs.statSync(ytdlTempPath);
          if (stats.size === 0) {
            throw new Error("Arquivo vazio do ytdl-core");
          }

          console.log(`Download ytdl-core concluído: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

          // Converter para MP3/M4A
          const result = await ffmpeg.convertAudio(ytdlTempPath);
          finalAudioPath = result.path;
          
          console.log(`Conversão concluída: ${result.format.toUpperCase()}`);
          
        } catch (ytdlError) {
          console.error("ytdl-core também falhou:", ytdlError);
          throw innertubeError; // Lança o erro original do Innertube
        }
      }

      // Enviar o áudio
      await sendAudioFromFile(finalAudioPath, true, true);
      await sendSuccessReact();
      
    } catch (error) {
      console.error("Erro detalhado:", error);
      
      let errorMessage = "Ocorreu um erro ao processar o áudio.";
      
      if (error.message === "age_restricted") {
        errorMessage = `
❌ *Vídeo com restrição de idade*

Este vídeo não pode ser baixado sem autenticação.

🔗 Link: ${videoUrl}
        `.trim();
        
      } else if (error.message.includes("Streaming data not available") || 
                 error.message === "no_audio_format" ||
                 error.message.includes("empty_file")) {
        errorMessage = `
❌ *Não foi possível baixar este vídeo*

Possíveis causas:
• Vídeo privado ou com restrições
• Bloqueio regional
• Vídeo muito recente (ainda processando)
• Problemas temporários do YouTube

*Sugestões:*
• Tente outro vídeo mais popular
• Aguarde alguns minutos
• Busque vídeos mais antigos

🔗 Link: ${videoUrl}
        `.trim();
        
      } else if (error.message.includes("410") || error.message.includes("403")) {
        errorMessage = "Este vídeo está bloqueado ou foi removido.";
        
      } else {
        errorMessage = `Erro ao processar: ${error.message}`;
      }
      
      throw new WarningError(errorMessage);
      
    } finally {
      // Limpar arquivos temporários
      const filesToClean = [
        tempAudioPath,
        ytdlTempPath,
        finalAudioPath
      ];
      
      for (const file of filesToClean) {
        try {
          if (file && fs.existsSync(file)) {
            await ffmpeg.cleanup(file);
          }
        } catch (e) {
          console.error(`Erro ao deletar ${file}:`, e);
        }
      }
    }
  },
};