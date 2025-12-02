/**
 * Serviços de processamento de imagens e áudio.
 * VERSÃO COMPLETA E ESTÁVEL (FFMPEG + SHARP)
 * * Correções incluídas:
 * 1. /fig10: Usa corte via GIF para resetar timestamps e evitar figurinhas cinzas.
 * 2. /togif: Usa Sharp para ler WebP e FFmpeg para gerar MP4 compatível.
 * 3. Dependências: Requer 'sharp' instalado (npm install sharp).
 *
 * @author MRX / Refatorado por Gemini
 */
import { exec } from "child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp"; // Essencial para manipulação robusta de imagens/GIFs
import { TEMP_DIR } from "../config.js";
import { getRandomNumber } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";

class Ffmpeg {
  constructor() {
    this.tempDir = TEMP_DIR;
  }

  /**
   * Executa comandos no terminal
   */
  async _executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        // Ignora erros não fatais, rejeita apenas se o código de saída for erro
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
   * Cria Sticker (WebP) Simples.
   * Usado para imagens ou vídeos curtos que não precisam de corte específico.
   */
  async createSticker(inputPath, isVideo = false) {
    // Se for vídeo, usamos a lógica do cutVideoToWebP (do 0 ao 10s) para garantir qualidade
    if (isVideo) {
      return this.cutVideoToWebP(inputPath, 0, 10);
    }

    // Para imagens estáticas, FFmpeg direto é mais rápido
    const outputPath = await this._createTempFilePath("webp");
    const command = `ffmpeg -i "${inputPath}" ` +
        `-vf "scale=512:512:force_original_aspect_ratio=decrease" ` +
        `-f webp -quality 90 ` +
        `"${outputPath}"`;
    
    await this._executeCommand(command);
    return outputPath;
  }

  /**
   * MÁGICA DO FIG10: Corta vídeo e converte para WebP.
   * * Estratégia "Híbrida":
   * 1. FFmpeg corta e gera um GIF. (GIF obrigatoriamente reseta o tempo para 0s).
   * 2. Sharp converte o GIF para WebP. (Garante headers corretos e sem corrupção).
   */
  async cutVideoToWebP(inputPath, startTime, duration) {
    const gifTempPath = await this._createTempFilePath("gif");
    const webpOutputPath = await this._createTempFilePath("webp");

    try {
      // 1. FFmpeg: Corta -> Redimensiona -> GIF
      // -ss antes do -i: Fast seek (rápido)
      // fps=8: Mantém leve
      // split+palettegen: Garante cores melhores no GIF intermediário
      const command = `ffmpeg -y -ss ${startTime} -t ${duration} -i "${inputPath}" ` +
        `-vf "fps=8,scale=512:512:force_original_aspect_ratio=decrease,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" ` +
        `-f gif ` +
        `"${gifTempPath}"`;

      await this._executeCommand(command);

      // 2. Sharp: GIF -> WebP Animado
      // O Sharp é muito mais estável para gerar o WebP final que o FFmpeg antigo
      await sharp(gifTempPath, { animated: true })
        .webp({
          quality: 50,    // Qualidade média para arquivo pequeno
          effort: 3,      // Esforço baixo para ser rápido
          loop: 0         // Loop infinito
        })
        .toFile(webpOutputPath);

      return webpOutputPath;

    } catch (error) {
      console.error("Erro no processo Cut -> GIF -> WebP:", error);
      throw error;
    } finally {
      // Limpa o GIF temporário
      if (fs.existsSync(gifTempPath)) fs.unlinkSync(gifTempPath);
    }
  }

  // ===========================================================================
  // CONVERSÃO PARA GIF/VIDEO (/togif)
  // ===========================================================================

  /**
   * Converte Sticker Animado (WebP) para MP4.
   * Resolve o erro "unsupported chunk: ANIM" usando Sharp para ler o WebP.
   */
  async convertStickerToGif(inputPath) {
    const gifTempPath = await this._createTempFilePath("gif");
    const mp4OutputPath = await this._createTempFilePath("mp4");

    try {
      // 1. Sharp: Lê o WebP animado (que o FFmpeg falha) e salva como GIF
      await sharp(inputPath, { animated: true })
        .toFormat("gif")
        .toFile(gifTempPath);

      // 2. FFmpeg: Converte GIF para MP4 (H.264)
      // -pix_fmt yuv420p: Obrigatório para o WhatsApp
      // -vf scale: Garante dimensões pares (obrigatório para MP4)
      const command = `ffmpeg -y -i "${gifTempPath}" ` +
        `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ` +
        `-c:v libx264 -preset fast -crf 26 ` +
        `-pix_fmt yuv420p ` +
        `-movflags faststart ` +
        `"${mp4OutputPath}"`;

      await this._executeCommand(command);
      return mp4OutputPath;

    } catch (error) {
      console.error("Erro na conversão Sharp -> FFmpeg:", error);
      throw error;
    } finally {
      if (fs.existsSync(gifTempPath)) fs.unlinkSync(gifTempPath);
    }
  }

  // ===========================================================================
  // FILTROS DE IMAGEM E ÁUDIO (EXTRAS)
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
    // Usa libmp3lame para garantir formato MP3 real
    const command = `ffmpeg -i ${inputPath} -vn -acodec libmp3lame -b:a 192k ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }

  /**
   * Limpa arquivos temporários
   */
  async cleanup(filePath) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Erro ao deletar arquivo ${filePath}:`, err);
      }
    }
  }
}

export { Ffmpeg };