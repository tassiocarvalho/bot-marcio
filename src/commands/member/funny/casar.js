import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";

// Armazena pedidos de casamento pendentes
// Estrutura: { groupId: { targetLid: { senderLid, timestamp } } }
const pendingProposals = new Map();

// Limpa pedidos expirados (mais de 5 minutos)
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

// Verifica se existe pedido pendente
function hasPendingProposal(groupId, targetLid) {
  cleanExpiredProposals();
  return pendingProposals.get(groupId)?.[targetLid];
}

// Cria um novo pedido
function createProposal(groupId, targetLid, senderLid) {
  cleanExpiredProposals();
  
  if (!pendingProposals.has(groupId)) {
    pendingProposals.set(groupId, {});
  }
  
  pendingProposals.get(groupId)[targetLid] = {
    senderLid,
    timestamp: Date.now(),
  };
}

// Remove um pedido
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
    remoteJid 
  }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar alguém para pedir em casamento!"
      );
    }

    const targetLid = isReply ? replyLid : args[0] ? `${onlyNumbers(args[0])}@lid` : null;

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

    // Verifica se já existe um pedido pendente
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

⏰ Depois de 5 minutos o pedido expira...
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
        
        const expiredImagePath = path.resolve(ASSETS_DIR, "images", "casar", "rejeitado.jpg");
        await sendImageFromFile(expiredImagePath, expiredMessage, [sender, targetLid]);
      }
    }, 5 * 60 * 1000); // 5 minutos
  },
};