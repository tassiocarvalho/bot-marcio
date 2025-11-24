import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";

// Importa as mesmas funções do casar.js
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
    remoteJid 
  }) => {
    if (!args.length) {
      throw new InvalidParameterError(
        `Você precisa mencionar quem fez o pedido!\n\nExemplo: ${PREFIX}rejeitar @fulano`
      );
    }

    const proposerLid = `${onlyNumbers(args[0])}@lid`;

    // Verifica se existe um pedido pendente para o remetente atual
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
    const proposerNumber = onlyNumbers(proposerLid);
    
    const messageText = `
💔 *PEDIDO REJEITADO* 💔

@${senderNumber} rejeitou o pedido de casamento de @${proposerNumber}! 😢

Às vezes o amor não é correspondido... 🥀

Força aí, guerreiro(a)! 💪
`;

    const imagePath = path.resolve(ASSETS_DIR, "images", "casar", "rejeitado.jpg");
    await sendImageFromFile(imagePath, messageText, [sender, proposerLid]);
  },
};