/**
 * Serviços de processamento de imagens e áudio.
 * Integração: FFmpeg + Sharp
 */
import { exec } from "child_process";
import fs from "node:fs";
import path from "node:path";
// Importante: Importando o sharp recém instalado
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
        if (error) {
          // Ignora avisos inofensivos, foca nos erros reais
          if (stderr && !stderr.includes("Conversion failed")) {
             // console.warn("FFmpeg Warning:", stderr); 
          }
          
          if (error.code === 127) {
            errorLog("FFmpeg não encontrado. Certifique-se de que está instalado e no PATH.");
            return reject(new Error("FFmpeg não está instalado ou acessível."));
          }
          
          // Se realmente falhou
          if (error.code !== 0) {
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

  // --- MÉTODOS PÚBLICOS ---

  /**
   * Cria Sticker (WebP) - Otimizado para não cortar vídeos
   */
  async createSticker(inputPath, isVideo = false, startTime = 0, duration = null) {
    const outputPath = await this._createTempFilePath("webp");
    let command;

    if (isVideo) {
      // DEFININDO O FILTRO DE CORTE
      // Se tiver duração (fig10), usamos 'trim' e resetamos o tempo (setpts)
      // Se não (sticker normal), apenas redimensionamos.
      let filterStart = "";
      
      if (duration) {
         // trim: Corta o vídeo
         // setpts=PTS-STARTPTS: Reseta o cronômetro do vídeo para 0.0s (ESSENCIAL)
         filterStart = `trim=start=${startTime}:duration=${duration},setpts=PTS-STARTPTS,`;
      }

      // Montagem do comando
      command = `ffmpeg -y -i "${inputPath}" ` +
        `-vcodec libwebp ` +
        // Note que o ${filterStart} entra antes do scale
        `-filter_complex "[0:v] ${filterStart} scale=512:512:force_original_aspect_ratio=decrease, fps=8, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" ` +
        `-loop 0 -an -vsync 0 ` +
        `-map_metadata -1 ` +
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
   * Converte Sticker Animado para MP4 (via Sharp -> GIF -> FFmpeg)
   * Resolve o erro "unsupported chunk: ANIM" do Debian
   */
  async convertStickerToGif(inputPath) {
    // Arquivos temporários
    const gifTempPath = await this._createTempFilePath("gif");
    const mp4OutputPath = await this._createTempFilePath("mp4");

    try {
      // 1. SHARP: Converte WebP Animado -> GIF
      // O Sharp não tem o bug do FFmpeg e consegue ler a animação corretamente
      await sharp(inputPath, { animated: true })
        .toFormat("gif")
        .toFile(gifTempPath);

      // 2. FFmpeg: Converte GIF -> MP4 (H.264)
      // Otimizado para WhatsApp (yuv420p, dimensões pares)
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
      // Limpa o GIF intermediário para não encher o disco
      if (fs.existsSync(gifTempPath)) {
        fs.unlinkSync(gifTempPath);
      }
    }
  }

  // --- OUTROS MÉTODOS (Mantidos) ---

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