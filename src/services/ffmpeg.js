/**
 * Serviços de processamento de imagens e áudio.
 * VERSÃO FINAL: "VISUALLY ADEQUATE" (Equilíbrio Visual x Performance)
 * * Ajustes realizados:
 * 1. Compressão Inteligente: Usa dither Bayer no FFmpeg para gerar GIFs leves.
 * 2. Formato: 1:1 Esticado (Fill) para preencher a figurinha inteira.
 * 3. Qualidade: Ajustada para 40 (Sharp) com Effort 0 (Rápido).
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
          // Ignora warnings, foca em erros reais
          if (!stderr.includes("Conversion failed")) {
             // console.warn(stderr); // Descomente para debug
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
  // MÉTODOS DE STICKER (CORE)
  // ===========================================================================

  /**
   * Cria Sticker (WebP).
   */
  async createSticker(inputPath, isVideo = false) {
    // 1. VÍDEOS (Animados)
    if (isVideo) {
      // Chama o método especialista em compressão de vídeo
      return this.cutVideoToWebP(inputPath, 0, 10);
    }

    // 2. IMAGENS (Estáticas)
    const outputPath = await this._createTempFilePath("webp");
    
    try {
      await sharp(inputPath)
        .resize(512, 512, { fit: 'fill' }) // Estica para preencher
        .webp({ quality: 70, effort: 0 })  // Qualidade boa para fotos
        .toFile(outputPath);
        
      return outputPath;

    } catch (error) {
      console.error("Erro Sharp (Imagem):", error);
      // Fallback FFmpeg
      const command = `ffmpeg -i "${inputPath}" -vf "scale=512:512" -f webp -quality 70 "${outputPath}"`;
      await this._executeCommand(command);
      return outputPath;
    }
  }

  /**
   * MÁGICA DOS VÍDEOS (ANIMADOS)
   * Reduz qualidade do vídeo para um nível adequado e gera figurinha.
   */
  async cutVideoToWebP(inputPath, startTime, duration) {
    const gifTempPath = await this._createTempFilePath("gif");
    const webpOutputPath = await this._createTempFilePath("webp");

    try {
      // 1. FFmpeg: Gera GIF OTIMIZADO
      // - fps=8: Fluidez aceitável para stickers
      // - scale=512:512: Formato quadrado esticado
      // - dither=bayer:bayer_scale=5: O pulo do gato! Cria um pontilhado que
      //   reduz o tamanho do arquivo drasticamente sem destruir a imagem visualmente.
      const videoFilter = `fps=8,scale=512:512,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`;

      const command = `ffmpeg -y -ss ${startTime} -t ${duration} -i "${inputPath}" ` +
        `-vf "${videoFilter}" ` +
        `-f gif ` +
        `"${gifTempPath}"`;

      await this._executeCommand(command);

      // 2. Sharp: Converte GIF -> WebP (Equilíbrio Visual)
      // quality: 40 -> Visualmente "Adequado" (não é HD, mas não é borrão)
      // effort: 0   -> Velocidade máxima para não travar o bot
      await sharp(gifTempPath, { animated: true })
        .webp({
          quality: 40,
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
  // OUTROS MÉTODOS
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

  // Métodos auxiliares de imagem (Blur, Grayscale, etc)
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