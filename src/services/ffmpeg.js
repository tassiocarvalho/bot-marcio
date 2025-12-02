/**
 * Serviços de processamento de imagens e áudio usando ffmpeg e sharp.
 * * Atualizações:
 * - Integração com Sharp para corrigir erro de leitura de WebP Animado.
 * - Método cutVideo separado para garantir cortes precisos no fig10.
 * - Otimização de compressão para stickers de até 10s.
 *
 * @author MRX / Refatorado por Gemini
 */
import { exec } from "child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp"; // Necessário para o /togif funcionar no Linux Debian
import { TEMP_DIR } from "../config.js";
import { getRandomNumber } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";

class Ffmpeg {
  constructor() {
    this.tempDir = TEMP_DIR;
  }

  /**
   * Executa comandos no terminal do sistema.
   */
  async _executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        // Ignora erros que não travam o processo (warnings do ffmpeg)
        if (error && error.code !== 0) {
          // Loga apenas se for um erro real de falha
          errorLog(`FFmpeg Error: ${stderr}`);
          return reject(new Error(`FFmpeg failed: ${stderr}`));
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Gera um caminho de arquivo temporário aleatório.
   */
  async _createTempFilePath(extension = "png") {
    return path.join(
      this.tempDir,
      `${getRandomNumber(10_000, 99_999)}.${extension}`
    );
  }

  // ===========================================================================
  // MÉTODOS DE VÍDEO E STICKER (CORE)
  // ===========================================================================

  /**
   * Corta um vídeo com precisão (Hard Cut).
   * Gera um novo arquivo .mp4 que começa do tempo 0.0s.
   * Essencial para o comando /fig10 não gerar figurinhas cinzas.
   */
  async cutVideo(inputPath, startTime, duration) {
    const outputPath = await this._createTempFilePath("mp4");
    
    // -ss antes do -i é rápido, mas impreciso. Depois do -i é preciso.
    // Usamos preset ultrafast pois é apenas um corte temporário.
    const command = `ffmpeg -y -i "${inputPath}" ` +
      `-ss ${startTime} -t ${duration} ` +
      `-c:v libx264 -preset ultrafast -an ` + // -an remove áudio (desnecessário pra sticker)
      `"${outputPath}"`;

    await this._executeCommand(command);
    return outputPath;
  }

  /**
   * Cria uma figurinha (WebP).
   * Se for vídeo, aplica compressão agressiva para caber 10s em 1MB.
   * Não realiza cortes (use cutVideo antes se precisar cortar).
   */
  async createSticker(inputPath, isVideo = false) {
    const outputPath = await this._createTempFilePath("webp");
    let command;

    if (isVideo) {
      // Configuração OTIMIZADA para vídeos de até 10s
      // fps=8: Reduz frames para economizar espaço
      // q:v 15: Qualidade reduzida para não estourar 1MB
      // compression_level 6: Esforço máximo do encoder
      command = `ffmpeg -y -i "${inputPath}" ` +
        `-vcodec libwebp ` +
        `-filter_complex "[0:v] scale=512:512:force_original_aspect_ratio=decrease, fps=8, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" ` +
        `-loop 0 -vsync 0 ` +
        `-preset picture ` + 
        `-q:v 15 ` +  
        `-compression_level 6 ` +
        `-fs 0.99M ` + 
        `"${outputPath}"`;
    } else {
      // Configuração para imagens estáticas
      command = `ffmpeg -i "${inputPath}" ` +
        `-vf "scale=512:512:force_original_aspect_ratio=decrease" ` +
        `-f webp -quality 90 ` +
        `"${outputPath}"`;
    }

    await this._executeCommand(command);
    return outputPath;
  }

  /**
   * Converte Sticker Animado (WebP) para MP4.
   * Fluxo: WebP -> Sharp -> GIF -> FFmpeg -> MP4.
   * Resolve o erro "unsupported chunk: ANIM" em servidores Linux.
   */
  async convertStickerToGif(inputPath) {
    const gifTempPath = await this._createTempFilePath("gif");
    const mp4OutputPath = await this._createTempFilePath("mp4");

    try {
      // 1. Sharp: Lê o WebP animado e salva como GIF
      // O Sharp é mais robusto que o FFmpeg para ler WebP
      await sharp(inputPath, { animated: true })
        .toFormat("gif")
        .toFile(gifTempPath);

      // 2. FFmpeg: Converte GIF para MP4 (H.264)
      // -pix_fmt yuv420p: Obrigatório para o WhatsApp reproduzir
      // -scale: Garante dimensões pares
      const command = `ffmpeg -y -i "${gifTempPath}" ` +
        `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ` +
        `-c:v libx264 -preset fast -crf 26 ` +
        `-pix_fmt yuv420p ` +
        `-movflags faststart ` +
        `"${mp4OutputPath}"`;

      await this._executeCommand(command);
      
      return mp4OutputPath;

    } catch (error) {
      console.error("Erro na conversão Sharp/FFmpeg:", error);
      throw error;
    } finally {
      // Limpa o GIF intermediário
      if (fs.existsSync(gifTempPath)) {
        fs.unlinkSync(gifTempPath);
      }
    }
  }

  // ===========================================================================
  // FILTROS E UTILITÁRIOS DE IMAGEM/ÁUDIO
  // ===========================================================================

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
      fs.unlinkSync(filePath);
    }
  }
}

export { Ffmpeg };