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
          errorLog(`Command error: ${stderr}`);
          return reject(error);
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

  /**
   * Converte um arquivo de áudio para MP3.
   * @param {string} inputPath Caminho do arquivo de entrada (ex: .webm, .m4a)
   * @returns {Promise<string>} Caminho do arquivo MP3 de saída
   */
  async convertToMp3(inputPath) {
    const outputPath = await this._createTempFilePath("mp3");
    // -vn: remove vídeo, -acodec libmp3lame: usa codec mp3, -q:a 0: qualidade máxima
    const command = `ffmpeg -i ${inputPath} -vn -acodec libmp3lame -q:a 0 ${outputPath}`;
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
