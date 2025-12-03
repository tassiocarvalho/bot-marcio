/**
 * Serviços de processamento de imagens e áudio.
 * VERSÃO INTELIGENTE (AUTO-DETECT HD)
 * * Novidade:
 * - O bot agora detecta se o vídeo é "Pesado" (HD/Full HD/4K).
 * - Se for pesado (> 860px), ele aplica redução agressiva (FPS 6, Qualidade 20).
 * - Se for leve, ele mantém a qualidade visual boa (FPS 9, Qualidade 40).
 * - Mantém o formato 1:1 Esticado (Fill).
 */
import { exec } from "child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp"; 
import { TEMP_DIR } from "../config.js";
import { getRandomNumber } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";

class Ffmpeg {
  constructor() {
    this.tempDir = TEMP_DIR;
  }

  async _executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error && error.code !== 0) {
          if (!stderr.includes("Conversion failed")) {
             // console.warn(stderr); 
          } else {
             errorLog(`FFmpeg Error: ${stderr}`);
             return reject(new Error(`FFmpeg failed: ${stderr}`));
          }
        }
        resolve(stdout);
      });
    });
  }

  async _createTempFilePath(extension = "png") {
    return path.join(
      this.tempDir,
      `${getRandomNumber(10_000, 99_999)}.${extension}`
    );
  }

  // ===========================================================================
  // NOVO: DETECTOR DE RESOLUÇÃO
  // ===========================================================================
  
  /**
   * Pega a largura do vídeo para decidir qual qualidade usar.
   */
  async _getVideoWidth(inputPath) {
    return new Promise((resolve) => {
      // ffprobe vem junto com o ffmpeg, serve para ler metadados
      const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=s=x:p=0 "${inputPath}"`;
      
      exec(cmd, (error, stdout) => {
        if (error || !stdout) {
          console.warn("Não foi possível ler resolução. Usando modo padrão.");
          resolve(0); // Se falhar, assume 0 (modo padrão)
        } else {
          const width = parseInt(stdout.trim());
          resolve(isNaN(width) ? 0 : width);
        }
      });
    });
  }

  // ===========================================================================
  // MÉTODOS DE STICKER (CORE)
  // ===========================================================================

  async createSticker(inputPath, isVideo = false) {
    if (isVideo) {
      return this.cutVideoToWebP(inputPath, 0, 10);
    }

    // IMAGENS (Estáticas)
    const outputPath = await this._createTempFilePath("webp");
    try {
      await sharp(inputPath)
        .resize(512, 512, { fit: 'fill' }) 
        .webp({ quality: 70, effort: 0 }) 
        .toFile(outputPath);
      return outputPath;
    } catch (error) {
      console.error("Erro Sharp (Imagem):", error);
      const command = `ffmpeg -i "${inputPath}" -vf "scale=512:512" -f webp -quality 70 "${outputPath}"`;
      await this._executeCommand(command);
      return outputPath;
    }
  }

  /**
   * MÁGICA DOS VÍDEOS (COM INTELIGÊNCIA)
   * Verifica se o vídeo é HD. Se for, esmaga a qualidade. Se não, deixa bonito.
   */
  async cutVideoToWebP(inputPath, startTime, duration) {
    const gifTempPath = await this._createTempFilePath("gif");
    const webpOutputPath = await this._createTempFilePath("webp");

    try {
      // 1. Verificar tamanho do vídeo original
      const originalWidth = await this._getVideoWidth(inputPath);
      const isHeavyVideo = originalWidth > 860; // Consideramos "Pesado" se for maior que 860px (perto de 720p/1080p)

      // 2. Definir parâmetros dinâmicos
      let fps, ditherScale, webpQuality;

      if (isHeavyVideo) {
        // --- MODO PESADO (Para vídeos Full HD/4K) ---
        console.log(`Vídeo Pesado (${originalWidth}px). Aplicando compressão agressiva.`);
        fps = 3;              // FPS baixo para economizar
        ditherScale = 1;      // Dither forte (pontilhado) para reduzir cores
        webpQuality = 5;     // Qualidade baixa
      } else {
        // --- MODO PADRÃO (Para vídeos de Zap/Baixa Resolução) ---
        fps = 9;              // FPS mais fluido
        ditherScale = 5;      // Dither suave
        webpQuality = 30;     // Qualidade visualmente agradável
      }

      // 3. FFmpeg: Gera GIF
      // scale=512:512 (Estica 1:1)
      const videoFilter = `fps=${fps},scale=512:512,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer:bayer_scale=${ditherScale}`;

      const command = `ffmpeg -y -ss ${startTime} -t ${duration} -i "${inputPath}" ` +
        `-vf "${videoFilter}" ` +
        `-f gif ` +
        `"${gifTempPath}"`;

      await this._executeCommand(command);

      // 4. Sharp: Converte GIF -> WebP (Com os parâmetros escolhidos)
      await sharp(gifTempPath, { animated: true })
        .webp({
          quality: webpQuality,
          effort: 0, 
          loop: 0
        })
        .toFile(webpOutputPath);

      return webpOutputPath;

    } catch (error) {
      console.error("Erro Cut -> GIF -> WebP:", error);
      throw error;
    } finally {
      if (fs.existsSync(gifTempPath)) fs.unlinkSync(gifTempPath);
    }
  }

  // ===========================================================================
  // OUTROS MÉTODOS (TOGIF, MP3, ETC)
  // ===========================================================================

  async convertStickerToGif(inputPath) {
    const gifTempPath = await this._createTempFilePath("gif");
    const mp4OutputPath = await this._createTempFilePath("mp4");
    try {
      await sharp(inputPath, { animated: true }).toFormat("gif").toFile(gifTempPath);
      const command = `ffmpeg -y -i "${gifTempPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset fast -crf 26 -pix_fmt yuv420p -movflags faststart "${mp4OutputPath}"`;
      await this._executeCommand(command);
      return mp4OutputPath;
    } finally {
      if (fs.existsSync(gifTempPath)) fs.unlinkSync(gifTempPath);
    }
  }

  async convertToMp3(inputPath) {
    const outputPath = await this._createTempFilePath("mp3");
    const command = `ffmpeg -i ${inputPath} -vn -acodec libmp3lame -b:a 192k ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }

  // Filtros de imagem mantidos...
  async applyBlur(inputPath, intensity = "7:5") {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf boxblur=${intensity} ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }
  async convertToGrayscale(inputPath) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf format=gray ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }
  async mirrorImage(inputPath) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf hflip ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }
  async adjustContrast(inputPath, contrast = 1.2) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf eq=contrast=${contrast} ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }
  async applyPixelation(inputPath) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf 'scale=iw/6:ih/6, scale=iw*10:ih*10:flags=neighbor' ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }

  async cleanup(filePath) {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (err) { console.error(err); }
    }
  }
}

export { Ffmpeg };