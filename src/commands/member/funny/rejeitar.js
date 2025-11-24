import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js"; // Use a versão segura aqui
import {
  hasPendingProposal,
  removeProposal,
} from "../../../utils/marriage-proposals.js";

export default {
  name: "rejeitar",
  description: "Rejeita um pedido de casamento.",
  commands: ["rejeitar"],
  usage: `${PREFIX}rejeitar @usuario`,

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
        `Você precisa mencionar quem fez o pedido!\n\nExemplo: ${PREFIX}rejeitar @fulano`
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

    // Verifica se existe um pedido pendente para o remetente atual (sender)
    const proposal = hasPendingProposal(remoteJid, sender);

    if (!proposal) {
      await sendReply("Você não tem nenhum pedido de casamento pendente! 💔");
      return;
    }

    // Verifica se o pedido é da pessoa mencionada
    if (proposal.senderLid !== proposerLid) {
      const correctSenderNumber = onlyNumbers(proposal.senderLid);
      await sendReply(
        `Seu pedido pendente é de @${correctSenderNumber}, não de @${onlyNumbers(proposerLid)}!`
      );
      return;
    }

    // Remove o pedido
    removeProposal(remoteJid, sender);

    const senderNumber = onlyNumbers(sender);
    const proposerNumberFinal = onlyNumbers(proposerLid);

    const messageText = `
💔 *PEDIDO REJEITADO* 💔

@${senderNumber} rejeitou o pedido de casamento de @${proposerNumberFinal}! 😢

Às vezes o amor não é correspondido... 🥀

Força aí, guerreiro(a)! 💪
`;

    const imagePath = path.resolve(
      ASSETS_DIR,
      "images",
      "casar",
      "rejeitado.jpg"
    );
    await sendImageFromFile(imagePath, messageText, [sender, proposerLid]);
  },
};
