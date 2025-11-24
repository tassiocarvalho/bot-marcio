/**
 * Comando /play – pesquisa música no YouTube, baixa e envia como MP3.
 * SOLUÇÃO: Múltiplas estratégias de fallback anti-bot
 */

import InvalidParameterError from "../../../errors/InvalidParameterError.js";
import yts from "yt-search";
import fs from "node:fs";
import path from "node:path";
import { exec as execChild } from "node:child_process";
import { promisify } from "node:util";
import { PREFIX, TEMP_DIR } from "../../../config.js";
import { getRandomName } from "../../../utils/index.js";

const exec = promisify(execChild);

// Estratégias de download em ordem de prioridade
const DOWNLOAD_STRATEGIES = [
  {
    name: "android_music",
    args: [
      '-f bestaudio',
      '--extractor-args "youtube:player_client=android_music"',
      '--no-check-certificate',
      '--geo-bypass'
    ]
  },
  {
    name: "mediaconnect",
    args: [
      '-f bestaudio',
      '--extractor-args "youtube:player_client=mediaconnect"',
      '--no-check-certificate'
    ]
  },
  {
    name: "web_embed",
    args: [
      '-f bestaudio',
      '--extractor-args "youtube:player_client=web;player_skip=webpage,configs"',
      '--no-check-certificate'
    ]
  },
  {
    name: "mweb",
    args: [
      '-f bestaudio',
      '--extractor-args "youtube:player_client=mweb"',
      '--user-agent "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36"'
    ]
  }
];

async function tryDownload(videoUrl, outputPath, maxRetries = DOWNLOAD_STRATEGIES.length) {
  for (let i = 0; i < maxRetries; i++) {
    const strategy = DOWNLOAD_STRATEGIES[i];
    
    console.log(`[DEBUG] Tentativa ${i + 1}/${maxRetries}: estratégia "${strategy.name}"`);

    const baseArgs = [
      '--no-cache-dir',
      '--force-ipv4',
      '--extractor-retries 3',
      '--fragment-retries 3',
      '--no-warnings',
      '--no-check-formats'
    ];

    const ytDlpCommand = [
      'yt-dlp',
      ...strategy.args,
      ...baseArgs,
      `-o "${outputPath}"`,
      `"${videoUrl}"`
    ].join(' ');

    try {
      console.log(`[DEBUG] Executando: ${ytDlpCommand}`);
      await exec(ytDlpCommand, { timeout: 60000 }); // 60s timeout
      
      if (fs.existsSync(outputPath)) {
        console.log(`[DEBUG] ✓ Download bem-sucedido com estratégia "${strategy.name}"`);
        return true;
      }
    } catch (err) {
      console.error(`[DEBUG] ✗ Estratégia "${strategy.name}" falhou:`, err.message);
      
      // Se não é o último retry, continua
      if (i < maxRetries - 1) {
        console.log(`[DEBUG] Aguardando 2s antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
    }
  }
  
  return false;
}

export default {
  name: "play",
  description: "Baixa música do YouTube como MP3.",
  commands: ["play"],
  usage: `${PREFIX}play <nome da música>`,

  handle: async ({ args, sendReply, sendWaitReact, sendSuccessReact, sendFileReply, sendErrorReply }) => {
    console.log("[DEBUG] Entrou no comando /play");

    if (!args?.length) {
      console.log("[DEBUG] Nenhum argumento recebido.");
      throw new InvalidParameterError("Você precisa informar o nome da música!");
    }

    const query = args.join(" ");
    console.log("[DEBUG] Query:", query);

    await sendWaitReact();

    let info;
    try {
      console.log("[DEBUG] Pesquisando no yt-search…");
      const search = await yts(query);

      if (!search.videos.length) {
        console.log("[DEBUG] yt-search não retornou vídeos.");
        return sendReply("❌ Nenhum resultado encontrado no YouTube.");
      }

      info = search.videos[0];
      console.log("[DEBUG] Vídeo encontrado:", info.title);

    } catch (e) {
      console.error("[ERRO] yt-search falhou:", e);
      return sendReply("❌ Erro ao pesquisar no YouTube.");
    }

    await sendReply(
      `🎵 *Resultado encontrado:*\n\n` +
      `📌 *Título:* ${info.title}\n` +
      `👤 *Canal:* ${info.author.name}\n` +
      `⏱️ *Duração:* ${info.timestamp}\n` +
      `🔗 https://youtube.com/watch?v=${info.videoId}\n\n` +
      `⏳ Baixando e convertendo para MP3...`
    );

    const videoUrl = info.url;
    const tempInput = path.join(TEMP_DIR, getRandomName("webm"));
    const tempOutput = path.join(TEMP_DIR, getRandomName("mp3"));

    console.log("[DEBUG] Temp input:", tempInput);
    console.log("[DEBUG] Temp output:", tempOutput);

    try {
      console.log("[DEBUG] Iniciando download com múltiplas estratégias...");

      // Tenta download com fallback
      const downloadSuccess = await tryDownload(videoUrl, tempInput);

      if (!downloadSuccess) {
        console.error("[DEBUG] Todas as estratégias de download falharam");
        return sendErrorReply(
          "❌ Não foi possível baixar o áudio do YouTube.\n\n" +
          "💡 *Possíveis soluções:*\n" +
          "1. Atualize o yt-dlp: `pip install -U yt-dlp`\n" +
          "2. Tente outro vídeo\n" +
          "3. Aguarde alguns minutos e tente novamente"
        );
      }

      console.log("[DEBUG] Download concluído. Convertendo via ffmpeg…");

      // Conversão para MP3
      await exec(
        `ffmpeg -y -i "${tempInput}" -vn -ab 192k -ar 44100 -ac 2 "${tempOutput}"`,
        { timeout: 120000 } // 2min timeout
      );

      if (!fs.existsSync(tempOutput)) {
        console.log("[DEBUG] Falha: arquivo MP3 não gerado.");
        throw new Error("Conversão falhou.");
      }

      const fileSize = fs.statSync(tempOutput).size;
      console.log(`[DEBUG] MP3 gerado com sucesso (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      
      await sendSuccessReact();

      console.log("[DEBUG] Enviando arquivo ao usuário…");
      await sendFileReply(tempOutput, `${info.title}.mp3`);

    } catch (err) {
      console.error("[ERRO] Processo /play falhou:", err);
      
      // Mensagens de erro específicas
      if (err.killed || err.signal === 'SIGTERM') {
        return sendErrorReply("❌ O processo levou muito tempo e foi cancelado.");
      }
      
      if (err.message?.includes("ffmpeg")) {
        return sendErrorReply("❌ Erro na conversão do áudio. Verifique se o ffmpeg está instalado.");
      }
      
      return sendErrorReply("❌ Ocorreu um erro ao processar o áudio.");
      
    } finally {
      console.log("[DEBUG] Limpando arquivos temporários…");
      try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      } catch (cleanErr) {
        console.error("[ERRO] Falha ao limpar temporários:", cleanErr);
      }
    }
  },
};