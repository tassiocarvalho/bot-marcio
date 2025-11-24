/**
 * Este script é responsável
 * por carregar os eventos
 * que serão escutados pelo
 * socket do WhatsApp.
 *
 * @author Dev Gui
 */
import { TIMEOUT_IN_MILLISECONDS_BY_EVENT } from "./config.js";
import { onMessagesUpsert } from "./middlewares/onMesssagesUpsert.js";
import { badMacHandler } from "./utils/badMacHandler.js";
import { errorLog } from "./utils/logger.js";

export function load(socket) {

  // 🚀 FIX DEFINITIVO – garante que a função EXISTE antes de tudo
  if (!socket.sendTextReply) {
    socket.sendTextReply = async (m, text) => {
      console.log("[DEBUG] sendTextReply executando...");
      try {
        return await socket.sendMessage(
          m.key.remoteJid,
          { text },
          { quoted: m }
        );
      } catch (e) {
        console.error("[DEBUG] Erro dentro de sendTextReply:", e);
      }
    };
  }
  

  const safeEventHandler = async (callback, data, eventName) => {
    try {
      await callback(data);
    } catch (error) {
      if (badMacHandler.handleError(error, eventName)) {
        return;
      }
      errorLog(`Erro ao processar evento ${eventName}: ${error.message}`);
      if (error.stack) {
        errorLog(`Stack trace: ${error.stack}`);
      }
    }
  };

  socket.ev.on("messages.upsert", async (data) => {
    const startProcess = Date.now();
    setTimeout(() => {
      safeEventHandler(
        () =>
          onMessagesUpsert({
            socket,
            messages: data.messages,
            startProcess,
          }),
        data,
        "messages.upsert"
      );
    }, TIMEOUT_IN_MILLISECONDS_BY_EVENT);
  });

  process.on("uncaughtException", (error) => {
    if (badMacHandler.handleError(error, "uncaughtException")) {
      return;
    }
    errorLog(`Erro não capturado: ${error.message}`);
  });

  process.on("unhandledRejection", (reason) => {
    if (badMacHandler.handleError(reason, "unhandledRejection")) {
      return;
    }
    errorLog(`Promessa rejeitada não tratada: ${reason}`);
  });
}
