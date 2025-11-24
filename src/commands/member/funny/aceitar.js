import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";

// Mesmo sistema de pendingProposals
const pendingProposals = new Map();

function cleanExpiredProposals() {
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;

  for (const [groupId, proposals] of pendingProposals.entries()) {
    for (const [targetLid, data] of Object.entries(proposals)) {
      if (now - data.timestamp > FIVE_MINUTES) {
        delete proposals[targetLid];
      }
    }

    if (Object.keys(proposals).length === 0) {
      pendingProposals.delete(groupId);
    }
  }
}

function hasPendingProposal(groupId, targetLid) {
  cleanExpiredProposals();
  return pendingProposals.get(groupId)?.[targetLid];
}

function removeProposal(groupId, targetLid) {
  const proposals = pendingProposals.get(groupId);
  if (proposals) {
    delete proposals[targetLid];

    if (Object.keys(proposals).length === 0) {
      pendingProposals.delete(groupId);
    }
  }
}

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
    remoteJid
  }) => {
    if (!args.length) {
      throw new InvalidParameterError(
        `Você precisa mencionar quem fez o pedido!\n\nExemplo: ${PREFIX}aceitar @fulano`
      );
    }

    const proposerLid = `${onlyNumbers(args[0])}@lid`;

    // Verifica se existe um pedido pendente para o usuário
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
    const proposerNumber = onlyNumbers(proposerLid);

    const messageText = `
💖 *CASAMENTO ACEITO!* 💖

@${senderNumber} aceitou o pedido de casamento de @${proposerNumber}! 💍✨

🎉 Agora vocês estão oficialmente casados no bot! 🥂  
Que o amor de vocês dure para sempre! ❤️
`;

    const imagePath = path.resolve(ASSETS_DIR, "images", "casar", "aceito.jpg");
    await sendImageFromFile(imagePath, messageText, [sender, proposerLid]);
  },
};
