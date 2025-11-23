import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { Innertube } from "youtubei.js";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "../../../config.js";
import { Ffmpeg } from "../../../services/ffmpeg.js";
import fs from "node:fs";

// Função auxiliar para ler e formatar cookies
function getYoutubeCookies() {
  const cookiesPath = path.resolve(process.cwd(), "database", "youtube_cookies.json");
  
  if (fs.existsSync(cookiesPath)) {
    try {
      const rawData = fs.readFileSync(cookiesPath, "utf-8").trim();
      
      if (rawData.length === 0) {
        return null;
      }

      const cookiesArray = JSON.parse(rawData);
      
      // Converte para o formato esperado pelo Innertube
      const cookieString = cookiesArray
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join("; ");
      
      return cookieString;
      
    } catch (e) {
      console.error("Erro ao processar youtube_cookies.json:", e);
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
      const cookieString = getYoutubeCookies();
      
      const options = cookieString 
        ? { cookie: cookieString } 
        : {};

      innertube = await Innertube.create(options);
      
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
    const tempWebmPath = path.join(TEMP_DIR, `${video.id}_temp.webm`);
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
      // Buscar informações detalhadas do vídeo
      const videoInfo = await innertube.getInfo(video.id);
      
      // Verificar se o vídeo tem restrições
      if (videoInfo.basic_info.is_age_restricted) {
        throw new WarningError(
          "Este vídeo possui restrição de idade. Não é possível baixá-lo no momento."
        );
      }

      // Tentar baixar o stream de áudio
      const stream = await innertube.download(video.id, {
        type: "audio",
        quality: "best",
        format: "mp4", // Força formato mp4/m4a que é mais confiável
      });

      const fileStream = createWriteStream(tempWebmPath);

      await new Promise((resolve, reject) => {
        stream.pipe(fileStream);
        stream.on("error", (err) => {
          console.error("Erro no stream:", err);
          reject(err);
        });
        fileStream.on("finish", resolve);
        fileStream.on("error", (err) => {
          console.error("Erro ao escrever arquivo:", err);
          reject(err);
        });
      });

      // Verificar se o arquivo foi criado e tem conteúdo
      const stats = fs.statSync(tempWebmPath);
      if (stats.size === 0) {
        throw new Error("Arquivo de áudio vazio");
      }

      // Converter para MP3
      finalMp3Path = await ffmpeg.convertToMp3(tempWebmPath);

      // Enviar o áudio
      await sendAudioFromFile(finalMp3Path, true, true);
      await sendSuccessReact();
      
    } catch (error) {
      console.error("Erro detalhado ao processar áudio:", error);
      
      // Mensagens de erro mais específicas
      let errorMessage = "Ocorreu um erro ao processar o áudio.";
      
      if (error.message.includes("No valid URL")) {
        errorMessage = `
❌ *Não foi possível baixar este vídeo.*

Possíveis causas:
• Vídeo com restrição de idade
• Vídeo privado ou bloqueado
• Cookies do YouTube expirados
• Restrição geográfica

*Sugestões:*
1. Tente outro vídeo
2. Atualize os cookies do YouTube
3. Tente um vídeo mais popular/público

🔗 Link: ${videoUrl}
        `.trim();
      } else if (error.message.includes("age_restricted")) {
        errorMessage = "Este vídeo possui restrição de idade e não pode ser baixado.";
      } else {
        errorMessage = `Erro: ${error.message}`;
      }
      
      throw new WarningError(errorMessage);
      
    } finally {
      // Limpar arquivos temporários
      try {
        if (fs.existsSync(tempWebmPath)) {
          await ffmpeg.cleanup(tempWebmPath);
        }
        if (finalMp3Path && fs.existsSync(finalMp3Path)) {
          await ffmpeg.cleanup(finalMp3Path);
        }
      } catch (e) {
        console.error("Erro ao deletar arquivos temporários:", e);
      }
    }
  },
};