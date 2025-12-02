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
          // Loga o erro exato do FFmpeg para debug
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
   * Já inclui as otimizações para vídeos de até 10s não serem cortados.
   * @param {string} inputPath Caminho do arquivo de entrada
   * @param {boolean} isVideo Define se a entrada é um vídeo/gif
   */
  async createSticker(inputPath, isVideo = false) {
    const outputPath = await this._createTempFilePath("webp");
    let command;

    if (isVideo) {
      // MODO ULTRA ECONÔMICO PARA NÃO CORTAR O VÍDEO
      // - an: Remove áudio (garantia, pois áudio ocupa espaço inútil em sticker)
      // - fps=8: Reduzimos para 8 frames por segundo
      // - q:v 15: Qualidade baixa (lossy) para forçar o tamanho a ser pequeno
      // - compression_level 6: O FFmpeg vai demorar uns milissegundos a mais, mas vai espremer o arquivo
      
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
       // ... (mantenha o código de imagem igual estava)
    }

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
    // Melhoria: Usar libmp3lame para arquivos .mp3 reais (aac é para .m4a)
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