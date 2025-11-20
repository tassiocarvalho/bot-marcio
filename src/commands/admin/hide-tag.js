import { PREFIX } from "../../config.js";

export default {
  name: "hide-tag",
  description: "Este comando marcará todos do grupo",
  commands: ["hide-tag", "to-tag", "hidtag"],
  usage: `${PREFIX}hidtag motivo`,

  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ fullArgs, sendText, socket, remoteJid, sendReact, quoted, type }) => {
    const { participants } = await socket.groupMetadata(remoteJid);
    const mentions = participants.map(({ id }) => id);
    await sendReact("📢");

    let msgParaEnviar = "";

    // ----- 1. Se respondeu uma mensagem -----
    if (quoted) {
      // Se a mensagem respondida for texto
      if (quoted.msg && quoted.msg.conversation) {
        msgParaEnviar = quoted.msg.conversation;
      } else {
        return await sendText("❗ Marque uma mensagem **de texto**!", mentions);
      }
    }
    // ----- 2. Se escreveu algo após o comando -----
    else if (fullArgs.trim().length > 0) {
      msgParaEnviar = fullArgs.trim();
    }
    // ----- 3. Se usou o /hidtag sozinho -----
    else {
      msgParaEnviar = "📢 Marcando todos!";
    }

    await sendText(msgParaEnviar, mentions);
  },
};