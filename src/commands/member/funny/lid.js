import { PREFIX } from "../../../config.js";

export default {
  name: "lid",
  description: "Retorna o JID (LID) do usuário que executou o comando.",
  commands: ["lid", "jid"],
  usage: `${PREFIX}lid`,

  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ sendReply, userLid, replyLid, isReply, mentionedLid }) => {
    // 1. Identificar o alvo (LID)
    // Prioridade: 1. Menção na mensagem, 2. Resposta, 3. Usuário que executou o comando
    const targetLid = mentionedLid
      ? mentionedLid
      : isReply
      ? replyLid
      : userLid;

    const targetDescription = mentionedLid
      ? "O JID (LID) do usuário mencionado é:"
      : isReply
      ? "O JID (LID) do usuário respondido é:"
      : "Seu JID (LID) é:";

    await sendReply(`${targetDescription} \n\n\`\`\`${targetLid}\`\`\``);
  },
};
