import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { Innertube } from "youtubei.js";
import { exec } from "child_process";
import { promisify } from "util";
import path from "node:path";
import { TEMP_DIR } from "../../../config.js";
import { Ffmpeg } from "../../../services/ffmpeg.js";
import fs from "node:fs";

const execPromise = promisify(exec);

// Função para baixar áudio usando yt-dlp como fallback
async function downloadWithYtDlp(videoId, outputPath) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Comando yt-dlp otimizado para áudio
  const command = `yt-dlp -f "bestaudio" --extract-audio --audio-format mp3 --audio-quality 192K -o "${outputPath}" "${videoUrl}"`;
  
  try {
    await execPromise(command, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer
    return true;
  } catch (error) {
    console.error("Erro no yt-dlp:", error);
    return false;
  }
}

// Verifica se yt-dlp está instalado
async function isYtDlpInstalled() {
  try {
    await execPromise("yt-dlp --version");
    return true;
  } catch {
    return false;
  }
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

    // Verificar se yt-dlp está disponível
    const hasYtDlp = await isYtDlpInstalled();
    
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
    const tempAudioPath = path.join(TEMP_DIR, `${video.id}_temp`);
    const ytDlpOutputPath = path.join(TEMP_DIR, `${video.id}.mp3`);
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

        const fileStream = fs.createWriteStream(tempAudioPath);

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

        console.log(`Download concluído: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        // Converter para MP3/M4A
        const result = await ffmpeg.convertAudio(tempAudioPath);
        finalAudioPath = result.path;
        
        console.log(`Conversão concluída: ${result.format.toUpperCase()}`);

      } catch (innertubeError) {
        console.log(`Innertube falhou: ${innertubeError.message}`);
        
        // MÉTODO 2: Fallback para yt-dlp se disponível
        if (hasYtDlp) {
          console.log("Tentando download com yt-dlp...");
          downloadMethod = "yt-dlp";
          
          await sendReply("_Método alternativo de download ativado..._");
          
          const success = await downloadWithYtDlp(video.id, ytDlpOutputPath);
          
          if (!success || !fs.existsSync(ytDlpOutputPath)) {
            throw new Error("yt-dlp também falhou");
          }
          
          finalAudioPath = ytDlpOutputPath;
          console.log("Download com yt-dlp concluído!");
          
        } else {
          // Se yt-dlp não está disponível, lança o erro original
          throw innertubeError;
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
                 error.message === "no_audio_format") {
        errorMessage = `
❌ *Não foi possível acessar o áudio deste vídeo*

${hasYtDlp ? "Ambos os métodos falharam." : "💡 *Dica:* Instale o yt-dlp para melhor compatibilidade:\n\n```pip install yt-dlp```"}

Tente outro vídeo ou aguarde alguns minutos.

🔗 Link: ${videoUrl}
        `.trim();
        
      } else if (error.message.includes("yt-dlp também falhou")) {
        errorMessage = `
❌ *Nenhum método de download funcionou*

Possíveis causas:
• Vídeo privado ou bloqueado
• Restrição geográfica
• Problema temporário do YouTube

Tente outro vídeo.

🔗 Link: ${videoUrl}
        `.trim();
        
      } else {
        errorMessage = `Erro: ${error.message}`;
      }
      
      throw new WarningError(errorMessage);
      
    } finally {
      // Limpar arquivos temporários
      const filesToClean = [
        tempAudioPath,
        tempAudioPath + ".webm",
        tempAudioPath + ".m4a",
        finalAudioPath,
        ytDlpOutputPath
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