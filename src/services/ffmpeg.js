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
   * Usa o codec aac e bitrate fixo para maior compatibilidade.
   * @param {string} inputPath Caminho do arquivo de entrada (ex: .webm, .m4a)
   * @returns {Promise<string>} Caminho do arquivo MP3 de saída
   */
  async convertToMp3(inputPath) {
      const outputPath = await this._createTempFilePath("mp3");
      
      // Comando corrigido para MP3 real
      const command = `ffmpeg -i "${inputPath}" -vn -c:a mp3 -b:a 192k "${outputPath}"`;
      
      await this._executeCommand(command);
      
      // Verifica se o arquivo foi criado com sucesso
      if (!fs.existsSync(outputPath)) {
          throw new Error("Falha na conversão para MP3: arquivo de saída não encontrado");
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
          await this.cleanup(outputPath);
          throw new Error("Arquivo MP3 vazio gerado");
      }
      
      return outputPath;
  }
}

export { Ffmpeg };
