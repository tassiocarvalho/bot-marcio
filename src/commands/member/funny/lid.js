import { PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";

export default {
  name: "lid",
  description: "Mostra o LID (identificador) de um usuário no grupo.",
  commands: ["lid"],
  usage: `${PREFIX}lid @usuario ou respondendo a mensagem`,
  
  handle: async ({ sendTextMessage, sendErrorReply, replyLid, args, isReply, remoteJid }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou responder a mensagem de alguém para ver o LID!"
      );
    }

    const targetLid = isReply ? replyLid : args[0] ? `${onlyNumbers(args[0])}@lid` : null;

    if (!targetLid) {
      await sendErrorReply(
        "Não foi possível identificar o usuário. Mencione ou responda a mensagem de alguém."
      );
      return;
    }

    const cleanLid = onlyNumbers(targetLid);
    const lidType = targetLid.includes("@s.whatsapp.net") ? "Número Direto" : "LID de Grupo";
    const displayNumber = `@${cleanLid}`;

    const messageText = `
*📱 Informações do Usuário*

*Tipo:* ${lidType}
*Identificador:* \`${cleanLid}\`
*LID Completo:* \`${targetLid}\`

${lidType === "LID de Grupo" ? "⚠️ Este é um LID de grupo, não o número real do usuário." : "✅ Este é o número real do usuário."}
`;

    await sendTextMessage(messageText, [targetLid]);
  },
};