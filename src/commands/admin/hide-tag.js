import { PREFIX } from "../../config.js";

export default {
  name: "hide-tag",
  description: "Este comando marcará todos do grupo",
  commands: ["hide-tag", "to-tag", "hidtag"],
  usage: `${PREFIX}hidtag motivo

ou

${PREFIX}hidtag (respondendo uma mensagem de texto)`,

  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ 
    fullArgs, 
    sendText, 
    socket, 
    remoteJid, 
    sendReact,
    isReply,
    replyMessage
  }) => {
    const { participants } = await socket.groupMetadata(remoteJid);
    const mentions = participants.map(({ id }) => id);
    
    await sendReact("📢");

    let msgParaEnviar = "";

    // ----- 1. Se respondeu uma mensagem (isReply) -----
    if (isReply && replyMessage) {
      // Tenta pegar o texto da mensagem respondida
      const textoDaMensagem = 
        replyMessage.conversation || 
        replyMessage.extendedTextMessage?.text ||
        replyMessage.imageMessage?.caption ||
        replyMessage.videoMessage?.caption;

      if (textoDaMensagem) {
        msgParaEnviar = textoDaMensagem;
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
      msgParaEnviar = "Marcação do adimiro!";
    }

    await sendText(msgParaEnviar, mentions);
  },
};