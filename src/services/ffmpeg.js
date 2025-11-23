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
   * Usa o codec libmp3lame para gerar MP3 real.
   * @param {string} inputPath Caminho do arquivo de entrada (ex: .webm, .m4a, .opus)
   * @returns {Promise<string>} Caminho do arquivo MP3 de saída
   */
  async convertToMp3(inputPath) {
    const outputPath = await this._createTempFilePath("mp3");
    
    // Opções otimizadas para MP3:
    // -i: arquivo de entrada
    // -vn: remove vídeo (só áudio)
    // -acodec libmp3lame: codec MP3
    // -b:a 192k: bitrate de áudio (qualidade boa)
    // -ar 44100: sample rate padrão
    // -ac 2: 2 canais (estéreo)
    const command = `ffmpeg -i "${inputPath}" -vn -acodec libmp3lame -b:a 192k -ar 44100 -ac 2 "${outputPath}"`;
    
    await this._executeCommand(command);
    return outputPath;
  }

  /**
   * Alternativa: Converte para M4A (AAC) caso libmp3lame não esteja disponível
   * @param {string} inputPath Caminho do arquivo de entrada
   * @returns {Promise<string>} Caminho do arquivo M4A de saída
   */
  async convertToM4a(inputPath) {
    const outputPath = await this._createTempFilePath("m4a");
    const command = `ffmpeg -i "${inputPath}" -vn -acodec aac -b:a 192k "${outputPath}"`;
    await this._executeCommand(command);
    return outputPath;
  }

  /**
   * Converte áudio com fallback automático
   * Tenta MP3 primeiro, se falhar tenta M4A
   * @param {string} inputPath Caminho do arquivo de entrada
   * @returns {Promise<{path: string, format: string}>} Caminho e formato do arquivo
   */
  async convertAudio(inputPath) {
    try {
      // Tenta converter para MP3 primeiro
      const mp3Path = await this.convertToMp3(inputPath);
      return { path: mp3Path, format: "mp3" };
    } catch (error) {
      errorLog("Falha ao converter para MP3, tentando M4A...");
      // Se falhar, usa M4A como fallback
      const m4aPath = await this.convertToM4a(inputPath);
      return { path: m4aPath, format: "m4a" };
    }
  }

  async cleanup(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export { Ffmpeg };