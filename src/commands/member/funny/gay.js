import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers, getRandomNumber } from "../../../utils/index.js";

// Configurações de números especiais (fácil de adicionar mais)
const SPECIAL_NUMBERS = {
  "557583258635": 0,   // Sempre hetero
  "555496630919": 100, // Sempre gay
};

// Mapeamento de faixas de porcentagem para mensagens e GIFs
const GAY_RANGES = [
  { min: 0, max: 0, message: "É 100% hetero! 🚫", gif: "hetero.mp4" },
  { min: 1, max: 25, message: "É quase hetero. Ainda há esperança! 🤏", gif: "gay_1.mp4" },
  { min: 26, max: 49, message: "É quase meio gay. Está na dúvida! 🤔", gif: "gay_2.mp4" },
  { min: 50, max: 75, message: "É gay. Orgulho! 🏳️‍🌈", gif: "gay_3.mp4" },
  { min: 76, max: 99, message: "É gayzão! Não tem mais volta! 🌈", gif: "gay_4.mp4" },
  { min: 100, max: 100, message: "É o gay mais gay da terra! 👑", gif: "gay_5.mp4" },
];

/**
 * Normaliza número brasileiro adicionando DDI 55 se necessário
 */
function normalizePhoneNumber(lid) {
  let number = onlyNumbers(lid);
  
  // Se tem 10 ou 11 dígitos e não começa com 55, adiciona o DDI
  if ((number.length === 10 || number.length === 11) && !number.startsWith("55")) {
    number = "55" + number;
  }
  
  return number;
}

/**
 * Calcula a porcentagem gay do usuário
 */
function calculateGayPercentage(normalizedNumber) {
  // Verifica se é um número especial
  if (normalizedNumber in SPECIAL_NUMBERS) {
    return SPECIAL_NUMBERS[normalizedNumber];
  }
  
  // Caso contrário, gera aleatoriamente
  return getRandomNumber(0, 100);
}

export default {
  name: "gay",
  description: "Calcula a porcentagem gay de um usuário.",
  commands: ["gay"],
  usage: `${PREFIX}gay @usuario ou respondendo a mensagem`,
  
  handle: async ({ sendGifFromFile, sendErrorReply, replyLid, args, isReply }) => {
    // 1. Validar entrada
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar um membro para calcular a porcentagem gay!"
      );
    }

    // 2. Identificar o alvo
    const targetLid = isReply ? replyLid : args[0] ? `${onlyNumbers(args[0])}@lid` : null;

    if (!targetLid) {
      await sendErrorReply(
        "Não foi possível identificar o usuário. Mencione ou responda a mensagem de alguém."
      );
      return;
    }

    // 3. Normalizar número e calcular porcentagem
    const normalizedNumber = normalizePhoneNumber(targetLid);
    const percentage = calculateGayPercentage(normalizedNumber);

    // 4. Encontrar a faixa correspondente
    const range = GAY_RANGES.find(r => percentage >= r.min && percentage <= r.max);

    // 5. Construir e enviar resposta
    const targetMention = `@${normalizedNumber}`;
    const messageText = `
*Calculadora Gay* 🏳️‍🌈

${targetMention} é ${percentage}% gay!

*Resultado:* ${range.message}
`;

    const gifPath = path.resolve(ASSETS_DIR, "images", "gay", range.gif);
    await sendGifFromFile(gifPath, messageText, [targetLid]);
  },
};