import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { Innertube } from "youtubei.js";
import ytdl from "@distube/ytdl-core";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "../../../config.js";
import { Ffmpeg } from "../../../services/ffmpeg.js";
import fs from "node:fs";

// Agente para evitar bloqueios do YouTube
const agent = ytdl.createAgent();

// Função para baixar com @distube/ytdl-core
async function downloadWithYtdl(videoId, outputPath) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  return new Promise(async (resolve, reject) => {
    try {
      // Verificar se o vídeo existe e é acessível
      const info = await ytdl.getInfo(videoUrl, { agent });
      
      console.log(`Título: ${info.videoDetails.title}`);
      console.log(`Duração: ${info.videoDetails.lengthSeconds}s`);
      
      // Filtrar apenas formatos de áudio
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      
      if (!audioFormats.length) {
        throw new Error("Nenhum formato de áudio disponível");
      }
      
      console.log(`Formatos de áudio disponíveis: ${audioFormats.length}`);
      
      // Baixar com o melhor formato de áudio
      const stream = ytdl(videoUrl, {
        quality: 'highestaudio',
        filter: 'audioonly',
        agent: agent
      });

      const fileStream = createWriteStream(outputPath);

      let downloadedBytes = 0;

      stream.on('progress', (chunkLength, downloaded, total) => {
        downloadedBytes = downloaded;
        const percent = ((downloaded / total) * 100).toFixed(1);
        console.log(`Download: ${percent}% (${(downloaded / 1024 / 1024).toFixed(2)} MB)`);
      });

      stream.pipe(fileStream);

      stream.on('error', (err) => {
        console.error('Erro no stream:', err);
        reject(err);
      });

      fileStream.on('finish', () => {
        console.log(`Download concluído: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
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
    const tempAudioPath = path.join(TEMP_DIR, `${video.id}_audio.webm`);
    let finalAudioPath = null;
    const ffmpeg = new Ffmpeg();

    const infoMessage = `
*Vídeo Encontrado:*
*Título:* ${video.title}
*Canal:* ${video.author.name}
*Duração:* ${video.duration?.text || 'N/A'}
*Views:* ${video.views?.text || 'N/A'}
*Link:* ${videoUrl}

*Baixando áudio...*
    `;
    
    await sendReply(infoMessage);
    
    try {
      // Usar diretamente o @distube/ytdl-core (mais confiável)
      console.log("Iniciando download com @distube/ytdl-core...");
      
      await downloadWithYtdl(video.id, tempAudioPath);
      
      // Verificar se o arquivo foi criado
      if (!fs.existsSync(tempAudioPath)) {
        throw new Error("Arquivo de áudio não foi criado");
      }

      const stats = fs.statSync(tempAudioPath);
      if (stats.size === 0) {
        throw new Error("Arquivo de áudio está vazio");
      }

      console.log(`Arquivo baixado: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Converter para MP3/M4A
      await sendReply("_Convertendo para MP3..._");
      
      const result = await ffmpeg.convertAudio(tempAudioPath);
      finalAudioPath = result.path;
      
      console.log(`Conversão concluída: ${result.format.toUpperCase()}`);

      // Enviar o áudio
      await sendAudioFromFile(finalAudioPath, true, true);
      await sendSuccessReact();
      
    } catch (error) {
      console.error("Erro detalhado:", error);
      
      let errorMessage = "Ocorreu um erro ao processar o áudio.";
      
      if (error.message.includes("Video unavailable")) {
        errorMessage = `
❌ *Vídeo indisponível*

Este vídeo não pode ser acessado. Pode estar:
• Privado
• Removido
• Bloqueado na sua região

🔗 Link: ${videoUrl}
        `.trim();
        
      } else if (error.message.includes("age")) {
        errorMessage = `
❌ *Vídeo com restrição de idade*

Este vídeo requer autenticação para ser baixado.

🔗 Link: ${videoUrl}
        `.trim();
        
      } else if (error.message.includes("premieres in") || 
                 error.message.includes("This live event")) {
        errorMessage = `
❌ *Vídeo ao vivo ou agendado*

Este conteúdo ainda não está disponível para download.

🔗 Link: ${videoUrl}
        `.trim();
        
      } else if (error.message.includes("410") || error.message.includes("403")) {
        errorMessage = `
❌ *Acesso negado*

O YouTube bloqueou o acesso a este vídeo.
Tente outro vídeo ou aguarde alguns minutos.

🔗 Link: ${videoUrl}
        `.trim();
        
      } else if (error.message.includes("Nenhum formato")) {
        errorMessage = `
❌ *Formato de áudio não disponível*

Este vídeo não possui áudio para download.

🔗 Link: ${videoUrl}
        `.trim();
        
      } else if (error.message.includes("FFmpeg")) {
        errorMessage = `
❌ *Erro na conversão*

O áudio foi baixado mas houve erro ao converter.
Detalhes: ${error.message}

🔗 Link: ${videoUrl}
        `.trim();
        
      } else {
        errorMessage = `
❌ *Erro ao processar*

${error.message}

Tente:
• Outro vídeo
• Aguardar alguns minutos
• Um vídeo mais popular/antigo

🔗 Link: ${videoUrl}
        `.trim();
      }
      
      throw new WarningError(errorMessage);
      
    } finally {
      // Limpar arquivos temporários
      const filesToClean = [tempAudioPath, finalAudioPath];
      
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