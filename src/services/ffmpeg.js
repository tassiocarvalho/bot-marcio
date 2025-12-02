/**
 * Serviços de processamento de imagens e áudio usando ffmpeg.
 *
 * @author MRX
 */
import { exec } from "child_process";
import fs from "node:fs";
import path from "node:path";
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
        if (error) {
          if (error.code === 127) {
            errorLog("FFmpeg não encontrado. Certifique-se de que está instalado e no PATH.");
            return reject(new Error("FFmpeg não está instalado ou acessível."));
          }
          errorLog(`FFmpeg Execution Error: ${stderr}`);
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

  /**
   * Cria uma figurinha (WebP) a partir de imagem ou vídeo.
   * OTIMIZADO: Configuração agressiva para evitar cortes em vídeos de 10s.
   */
  async createSticker(inputPath, isVideo = false) {
    const outputPath = await this._createTempFilePath("webp");
    let command;

    if (isVideo) {
      // Configuração para caber 10s em 1MB
      command = `ffmpeg -y -i "${inputPath}" ` +
        `-vcodec libwebp ` +
        `-filter_complex "[0:v] scale=512:512:force_original_aspect_ratio=decrease, fps=8, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" ` +
        `-loop 0 -an -vsync 0 ` +
        `-preset picture ` + 
        `-q:v 15 ` +  
        `-compression_level 6 ` +
        `-fs 0.99M ` + 
        `"${outputPath}"`;
    } else {
      command = `ffmpeg -i "${inputPath}" ` +
        `-vf "scale=512:512:force_original_aspect_ratio=decrease" ` +
        `-f webp -quality 90 ` +
        `"${outputPath}"`;
    }

    await this._executeCommand(command);
    return outputPath;
  }

  /**
   * NOVO: Converte Sticker (WebP) para GIF.
   * Necessário para o comando /togif funcionar.
   */
/**
   * Converte Sticker (WebP) para Vídeo MP4 (que será enviado como GIF).
   * Correção: Usa MP4 em vez de GIF real para evitar erro de "Chunk ANIM" 
   * e reduzir drasticamente o tamanho do arquivo.
   */
  async convertStickerToGif(inputPath) {
    const outputPath = await this._createTempFilePath("mp4");
    
    // 1. -vf "scale=..." garante dimensões pares (obrigatório para MP4/H264)
    // 2. -pix_fmt yuv420p garante compatibilidade com WhatsApp
    // 3. -movflags faststart otimiza para web
    const command = `ffmpeg -i "${inputPath}" ` +
      `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ` +
      `-c:v libx264 -preset fast -crf 26 ` +
      `-pix_fmt yuv420p ` +
      `-movflags faststart ` +
      `"${outputPath}"`;

    await this._executeCommand(command);
    return outputPath;
  }
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
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export { Ffmpeg };