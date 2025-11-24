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
    replyMessage,
    webMessage // Adicione esta prop se existir
  }) => {
    const { participants } = await socket.groupMetadata(remoteJid);
    const mentions = participants.map(({ id }) => id);
    
    await sendReact("📢");

    let msgParaEnviar = "";

    // ----- DEBUG: Veja a estrutura completa -----
    if (isReply) {
      console.log("=== DEBUG REPLY MESSAGE ===");
      console.log("isReply:", isReply);
      console.log("replyMessage:", JSON.stringify(replyMessage, null, 2));
      console.log("webMessage:", JSON.stringify(webMessage, null, 2));
      console.log("========================");
    }

    // ----- 1. Se respondeu uma mensagem (isReply) -----
    if (isReply && replyMessage) {
      // Tentativas de pegar o texto
      const textoDaMensagem = 
        replyMessage.conversation || 
        replyMessage.extendedTextMessage?.text ||
        replyMessage.text ||
        replyMessage.message?.conversation ||
        replyMessage.message?.extendedTextMessage?.text ||
        replyMessage.imageMessage?.caption ||
        replyMessage.videoMessage?.caption;

      if (textoDaMensagem) {
        msgParaEnviar = textoDaMensagem;
      } else {
        // Mostra a estrutura para debug
        return await sendText(
          `❗ Marque uma mensagem **de texto**!\n\n` +
          `DEBUG: Verifique o console para ver a estrutura da mensagem.`,
          mentions
        );
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