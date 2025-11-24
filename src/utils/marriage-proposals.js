/**
 * Módulo compartilhado para gerenciar pedidos de casamento
 */

// Armazena pedidos de casamento pendentes
// Estrutura: { groupId: { targetLid: { senderLid, timestamp } } }
const pendingProposals = new Map();

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Limpa pedidos expirados (mais de 5 minutos)
 */
function cleanExpiredProposals() {
  const now = Date.now();

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

/**
 * Verifica se existe pedido pendente para um usuário
 */
export function hasPendingProposal(groupId, targetLid) {
  cleanExpiredProposals();
  return pendingProposals.get(groupId)?.[targetLid];
}

/**
 * Cria um novo pedido de casamento
 */
export function createProposal(groupId, targetLid, senderLid) {
  cleanExpiredProposals();

  if (!pendingProposals.has(groupId)) {
    pendingProposals.set(groupId, {});
  }

  pendingProposals.get(groupId)[targetLid] = {
    senderLid,
    timestamp: Date.now(),
  };
}

/**
 * Remove um pedido de casamento
 */
export function removeProposal(groupId, targetLid) {
  const proposals = pendingProposals.get(groupId);
  if (proposals) {
    delete proposals[targetLid];

    if (Object.keys(proposals).length === 0) {
      pendingProposals.delete(groupId);
    }
  }
}

/**
 * Retorna o tempo de expiração em milissegundos
 */
export function getExpirationTime() {
  return FIVE_MINUTES;
}
