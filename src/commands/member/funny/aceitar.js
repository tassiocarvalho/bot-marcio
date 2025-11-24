import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";
import {
  hasPendingProposal,
  removeProposal,
} from "../../../utils/marriage-proposals.js";

export default {
  name: "aceitar",
  description: "Aceita um pedido de casamento.",
  commands: ["aceitar"],
  usage: `${PREFIX}aceitar @usuario`,

  handle: async ({
    sendImageFromFile,
    sendErrorReply,
    sendReply,
    args,
    sender,
    remoteJid,
  }) => {
    if (!args.length) {
      throw new InvalidParameterError(
        `Você precisa mencionar quem fez o pedido!\n\nExemplo: ${PREFIX}aceitar @fulano`
      );
    }

    const proposerNumber = onlyNumbers(args[0]);

    if (!proposerNumber) {
      await sendErrorReply(
        "Não foi possível identificar o usuário que fez o pedido. Mencione-o corretamente."
      );
      return;
    }

    const proposerLid = `${proposerNumber}@lid`;

    // Verifica se existe um pedido pendente para o usuário atual (sender)
    const proposal = hasPendingProposal(remoteJid, sender);

    if (!proposal) {
      await sendReply("Você não tem nenhum pedido de casamento pendente! 💔");
      return;
    }

    // Verifica se o pedido é da pessoa mencionada
    if (proposal.senderLid !== proposerLid) {
      const correctSender = onlyNumbers(proposal.senderLid);
      await sendReply(
        `Seu pedido pendente é de @${correctSender}, não de @${onlyNumbers(proposerLid)}!`
      );
      return;
    }

    // Remove o pedido da fila
    removeProposal(remoteJid, sender);

    const senderNumber = onlyNumbers(sender);
    const proposerNumberFinal = onlyNumbers(proposerLid);

    const messageText = `
💖 *CASAMENTO ACEITO!* 💖

@${senderNumber} aceitou o pedido de casamento de @${proposerNumberFinal}! 💍✨

🎉 Agora vocês estão oficialmente casados no bot! 🥂
Que o amor de vocês dure para sempre! ❤️
`;

    const imagePath = path.resolve(ASSETS_DIR, "images", "casar", "aceito.jpg");
    await sendImageFromFile(imagePath, messageText, [sender, proposerLid]);
  },
};
