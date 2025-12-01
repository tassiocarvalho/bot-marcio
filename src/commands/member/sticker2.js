/**
 * Desenvolvido por: Dev Gui
 * Implementação dos metadados feita por: MRX
 * Modificado para suportar vídeos longos divididos em múltiplas figurinhas
 *
 * @author Dev Gui
 */
import { exec as execChild } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { BOT_EMOJI, BOT_NAME, PREFIX, TEMP_DIR } from "../../config.js";
import { InvalidParameterError } from "../../errors/index.js";
import { addStickerMetadata } from "../../services/sticker.js";
import { getRandomName } from "../../utils/index.js";

const execPromise = promisify(execChild);

export default {
  name: "sticker-multi",
  description: "Cria figurinhas de imagem, gif ou vídeo (divide vídeos longos automaticamente).",
  commands: ["fig10"],
  usage: `${PREFIX}fig10 (marque ou responda uma imagem/gif/vídeo)`,
  handle: async ({
    isImage,
    isVideo,
    downloadImage,
    downloadVideo,
    webMessage,
    sendErrorReply,
    sendWaitReact,
    sendSuccessReact,
    sendStickerFromFile,
    sendReply,
    userLid,
  }) => {
    if (!isImage && !isVideo) {
      throw new InvalidParameterError(
        `Você precisa marcar ou responder a uma imagem/gif/vídeo!`
      );
    }

    await sendWaitReact();

    const username =
      webMessage.pushName ||
      webMessage.notifyName ||
      userLid.replace(/@lid/, "");

    const metadata = {
      username: username,
      botName: `${BOT_EMOJI} ${BOT_NAME}`,
    };

    let inputPath = null;
    const tempFiles = [];

    try {
      // PROCESSAMENTO DE IMAGEM (igual ao original)
      if (isImage) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            inputPath = await downloadImage(webMessage, getRandomName());
            break;
          } catch (downloadError) {
            console.error(
              `Tentativa ${attempt} de download de imagem falhou:`,
              downloadError.message
            );

            if (attempt === 3) {
              throw new Error(
                `Falha ao baixar imagem após 3 tentativas: ${downloadError.message}`
              );
            }

            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          }
        }

        const outputTempPath = path.resolve(TEMP_DIR, getRandomName("webp"));
        tempFiles.push(outputTempPath);

        await new Promise((resolve, reject) => {
          const cmd = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease" -f webp -quality 90 "${outputTempPath}"`;

          execChild(cmd, (error, _, stderr) => {
            if (error) {
              console.error("FFmpeg error:", stderr);
              reject(error);
            } else {
              resolve();
            }
          });
        });

        if (inputPath && fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
          inputPath = null;
        }

        const stickerPath = await addStickerMetadata(
          await fs.promises.readFile(outputTempPath),
          metadata
        );
        tempFiles.push(stickerPath);

        await sendSuccessReact();

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await sendStickerFromFile(stickerPath);
            break;
          } catch (stickerError) {
            console.error(
              `Tentativa ${attempt} de envio de sticker falhou:`,
              stickerError.message
            );

            if (attempt === 3) {
              throw new Error(
                `Falha ao enviar figurinha após 3 tentativas: ${stickerError.message}`
              );
            }

            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
      } 
      // PROCESSAMENTO DE VÍDEO COM DIVISÃO
      else {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            inputPath = await downloadVideo(webMessage, getRandomName());
            break;
          } catch (downloadError) {
            console.error(
              `Tentativa ${attempt} de download de vídeo falhou:`,
              downloadError.message
            );

            if (attempt === 3) {
              throw new Error(
                `Falha ao baixar vídeo após 3 tentativas. Problema de conexão com WhatsApp.`
              );
            }

            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          }
        }

        const maxDuration = 10;
        const seconds =
          webMessage.message?.videoMessage?.seconds ||
          webMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage
            ?.videoMessage?.seconds;

        if (!seconds) {
          if (inputPath && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
          }
          return sendErrorReply(
            `Não foi possível determinar a duração do vídeo. Tente novamente.`
          );
        }

        // Calcula quantas figurinhas serão necessárias
        const numberOfStickers = Math.ceil(seconds / maxDuration);
        const segmentDuration = seconds / numberOfStickers;

        console.log(`Vídeo de ${seconds}s será dividido em ${numberOfStickers} figurinha(s) de ~${segmentDuration.toFixed(1)}s cada`);

        // Se o vídeo for maior que 10s, avisa o usuário
        if (numberOfStickers > 1) {
          await sendReply(
            `⏱️ Vídeo de ${seconds}s detectado!\n\n` +
            `Criando ${numberOfStickers} figurinhas de ~${segmentDuration.toFixed(1)}s cada...\n\n` +
            `Aguarde alguns segundos... ⏳`
          );
        }

        // Processa cada segmento do vídeo
        for (let i = 0; i < numberOfStickers; i++) {
          const startTime = i * segmentDuration;
          const outputTempPath = path.resolve(TEMP_DIR, getRandomName("webp"));
          tempFiles.push(outputTempPath);

          // Comando FFmpeg para extrair e processar segmento
          const cmd = `ffmpeg -y -ss ${startTime.toFixed(2)} -i "${inputPath}" -t ${segmentDuration.toFixed(2)} -vcodec libwebp -fs 0.99M -filter_complex "[0:v] scale=512:512, fps=15, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" -f webp "${outputTempPath}"`;

          await new Promise((resolve, reject) => {
            execChild(cmd, (error, _, stderr) => {
              if (error) {
                console.error(`FFmpeg error no segmento ${i + 1}:`, stderr);
                reject(error);
              } else {
                resolve();
              }
            });
          });

          if (!fs.existsSync(outputTempPath)) {
            throw new Error(`Segmento ${i + 1} não foi criado pelo FFmpeg`);
          }

          // Adiciona metadados com número da parte
          const metadataWithPart = {
            ...metadata,
            username: numberOfStickers > 1 
              ? `${username} (${i + 1}/${numberOfStickers})` 
              : username,
          };

          const stickerPath = await addStickerMetadata(
            await fs.promises.readFile(outputTempPath),
            metadataWithPart
          );
          tempFiles.push(stickerPath);

          // Envia a figurinha
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await sendStickerFromFile(stickerPath);
              console.log(`Figurinha ${i + 1}/${numberOfStickers} enviada com sucesso`);
              break;
            } catch (stickerError) {
              console.error(
                `Tentativa ${attempt} de envio do sticker ${i + 1} falhou:`,
                stickerError.message
              );

              if (attempt === 3) {
                throw new Error(
                  `Falha ao enviar figurinha ${i + 1} após 3 tentativas: ${stickerError.message}`
                );
              }

              await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
          }

          // Pequeno delay entre envios para não sobrecarregar
          if (i < numberOfStickers - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (inputPath && fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
          inputPath = null;
        }

        await sendSuccessReact();

        // Mensagem final se foram múltiplas figurinhas
        if (numberOfStickers > 1) {
          await sendReply(
            `✅ ${numberOfStickers} figurinhas criadas com sucesso!`
          );
        }
      }

      // Limpeza de arquivos temporários
      tempFiles.forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    } catch (error) {
      console.error("Erro detalhado no comando sticker-multi:", error);

      // Limpeza em caso de erro
      if (inputPath && fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      tempFiles.forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      if (
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("AggregateError") ||
        error.message.includes("getaddrinfo ENOTFOUND") ||
        error.message.includes("connect ECONNREFUSED") ||
        error.message.includes("mmg.whatsapp.net")
      ) {
        throw new Error(
          `Erro de conexão ao baixar mídia do WhatsApp. Tente novamente em alguns segundos.`
        );
      }

      if (error.message.includes("FFmpeg")) {
        throw new Error(
          `Erro ao processar mídia com FFmpeg. Verifique se o arquivo não está corrompido.`
        );
      }

      throw new Error(`Erro ao processar a figurinha: ${error.message}`);
    }
  },
};
