/**
 * Serviços de processamento de imagens e áudio.
 * VERSÃO VELOCIDADE (SPEED MODE)
 * * Correção:
 * - Reduzido o 'effort' do Sharp de 6 (muito lento) para 0 (muito rápido).
 * - Isso resolve o problema do bot "ficar preso" ao gerar figurinhas animadas.
 * - Mantém o formato 1:1 esticado.
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
          errorLog(`FFmpeg Error: ${stderr}`);
          return reject(new Error(`FFmpeg failed: ${stderr}`));
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
      console.log("Processando vídeo animado..."); // Log para debug
      return this.cutVideoToWebP(inputPath, 0, 10);
    }

    // 2. IMAGENS (Estáticas)
    const outputPath = await this._createTempFilePath("webp");
    
    try {
      await sharp(inputPath)
        .resize(512, 512, { fit: 'fill' }) // Estica
        .webp({ quality: 60, effort: 0 }) // Rápido
        .toFile(outputPath);
        
      return outputPath;

    } catch (error) {
      console.error("Erro Sharp (Imagem):", error);
      // Fallback
      const command = `ffmpeg -i "${inputPath}" -vf "scale=512:512" -f webp -quality 60 "${outputPath}"`;
      await this._executeCommand(command);
      return outputPath;
    }
  }

  /**
   * MÁGICA DOS VÍDEOS (ANIMADOS) - OTIMIZADO PARA VELOCIDADE
   */
  async cutVideoToWebP(inputPath, startTime, duration) {
    const gifTempPath = await this._createTempFilePath("gif");
    const webpOutputPath = await this._createTempFilePath("webp");

    try {
      // 1. FFmpeg: Gera GIF (Rápido)
      // fps=8: Mantém leve
      // scale=512:512: Estica
      const videoFilter = `fps=8,scale=512:512,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

      const command = `ffmpeg -y -ss ${startTime} -t ${duration} -i "${inputPath}" ` +
        `-vf "${videoFilter}" ` +
        `-f gif ` +
        `"${gifTempPath}"`;

      await this._executeCommand(command);

      // 2. Sharp: Converte GIF -> WebP (MODO VELOZ)
      // MUDANÇA: effort: 0 (Mais rápido possível)
      // quality: 30 (Equilíbrio para não ficar gigante nem feio)
      await sharp(gifTempPath, { animated: true })
        .webp({
          quality: 30,       
          effort: 0,          // <--- AQUI ESTAVA O PROBLEMA (Era 6, travava o servidor)
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

  // --- FILTROS (MANTIDOS) ---
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

  async convertToMp3(inputPath) {
    const outputPath = await this._createTempFilePath("mp3");
    const command = `ffmpeg -i ${inputPath} -vn -acodec libmp3lame -b:a 192k ${outputPath}`;
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