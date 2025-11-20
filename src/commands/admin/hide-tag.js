import { PREFIX } from "../../config.js";

export default {
  name: "hidetag",
  description: "Marca todos do grupo",
  commands: ["hidetag", "hide-tag", "to-tag"],
  usage: `${PREFIX}hidetag`,

  handle: async ({ fullArgs, sendText, sendReact, socket, remoteJid, quoted }) => {
    const { participants } = await socket.groupMetadata(remoteJid);
    const mentions = participants.map(({ id }) => id);

    await sendReact("📢");

    let mensagemFinal = "";

    // ============================
    // 1) CAPTURAR TEXTO RESPONDIDO
    // ============================
    if (quoted) {
      let txt = null;

      const msg = quoted.msg;

      if (!msg) {
        return await sendText("❗ Marque uma mensagem **de texto**!", mentions);
      }

      // Tenta pegar texto de diferentes tipos
      txt =
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.buttonsResponseMessage?.selectedButtonId ||
        msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
        null;

      if (!txt) {
        return await sendText("❗ Marque uma mensagem **de texto**!", mentions);
      }

      mensagemFinal = txt;
    }

    // ============================
    // 2) /hidtag + texto
    // ============================
    else if (fullArgs.trim().length > 0) {
      mensagemFinal = fullArgs.trim();
    }

    // ============================
    // 3) /hidtag sozinho
    // ============================
    else {
      mensagemFinal = "📢 Marcando todos!";
    }

    // Envia mensagem final marcando todos
    await sendText(mensagemFinal, mentions);
  },
};