import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js"; // Use a versão segura aqui
import {
  hasPendingProposal,
  createProposal,
  removeProposal,
  getExpirationTime,
} from "../../../utils/marriage-proposals.js";

export default {
  name: "casar",
  description: "Pede alguém em casamento.",
  commands: ["casar"],
  usage: `${PREFIX}casar @usuario ou respondendo a mensagem`,

  handle: async ({
    sendImageFromFile,
    sendErrorReply,
    sendReply,
    replyLid,
    args,
    isReply,
    sender,
    remoteJid,
  }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar alguém para pedir em casamento!"
      );
    }

    let targetLid = isReply ? replyLid : null;

    if (!targetLid && args[0]) {
      const number = onlyNumbers(args[0]);
      if (number) {
        targetLid = `${number}@lid`;
      }
    }

    if (!targetLid) {
      await sendErrorReply(
        "Não foi possível identificar o usuário. Mencione ou responda a mensagem de alguém."
      );
      return;
    }

    if (targetLid === sender) {
      await sendReply("Você não pode se casar consigo mesmo! 😅");
      return;
    }

    // Verifica se já existe um pedido pendente para a pessoa
    const existingProposal = hasPendingProposal(remoteJid, targetLid);
    if (existingProposal) {
      const senderNumber = onlyNumbers(existingProposal.senderLid);
      await sendReply(
        `@${onlyNumbers(targetLid)} já tem um pedido de casamento pendente de @${senderNumber}! ⏳💍`
      );
      return;
    }

    // Cria o pedido
    createProposal(remoteJid, targetLid, sender);

    const senderNumber = onlyNumbers(sender);
    const targetNumber = onlyNumbers(targetLid);

    const messageText = `
💍 *PEDIDO DE CASAMENTO* 💍

@${senderNumber} está pedindo @${targetNumber} em casamento! 💕

🌹 Você tem *5 minutos* para responder:

✅ Para aceitar: *${PREFIX}aceitar @${senderNumber}*
❌ Para rejeitar: *${PREFIX}rejeitar @${senderNumber}*

⏰ Depois de 5 minutos o pedido expira automaticamente...
`;

    const imagePath = path.resolve(ASSETS_DIR, "images", "casar", "pedido.jpg");
    await sendImageFromFile(imagePath, messageText, [sender, targetLid]);

    // Timer para expiração automática
    setTimeout(async () => {
      const stillPending = hasPendingProposal(remoteJid, targetLid);
      if (stillPending && stillPending.senderLid === sender) {
        removeProposal(remoteJid, targetLid);

        const expiredMessage = `
⏰ *PEDIDO EXPIRADO* ⏰

O pedido de casamento de @${senderNumber} para @${targetNumber} expirou por falta de resposta! 💔

Talvez na próxima... 😔
`;

        const expiredImagePath = path.resolve(
          ASSETS_DIR,
          "images",
          "casar",
          "rejeitado.jpg"
        );
        await sendImageFromFile(expiredImagePath, expiredMessage, [
          sender,
          targetLid,
        ]);
      }
    }, getExpirationTime());
  },
};
