import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers, getRandomNumber } from "../../../utils/index.js";

// Mapeamento de faixas de porcentagem para mensagens e GIFs
const GAY_RANGES = [
  {
    min: 0,
    max: 0,
    message: "É 100% hetero! 🚫",
    gif: "hetero.mp4", // Imagem 1: Hetero
  },
  {
    min: 1,
    max: 25,
    message: "É quase hetero. Ainda há esperança! 🤏",
    gif: "gay_1.mp4", // Imagem 2: Quase Hetero
  },
  {
    min: 26,
    max: 49,
    message: "É quase meio gay. Está na dúvida! 🤔",
    gif: "gay_2.mp4", // Imagem 3: Quase Meio Gay
  },
  {
    min: 50,
    max: 75,
    message: "É gay. Orgulho! 🏳️‍🌈",
    gif: "gay_3.mp4", // Imagem 4: Gay
  },
  {
    min: 76,
    max: 99,
    message: "É gayzão! Não tem mais volta! 🌈",
    gif: "gay_4.mp4", // Imagem 5: Gayzão
  },
  {
    min: 100,
    max: 100,
    message: "É o gay mais gay da terra! 👑",
    gif: "gay_5.mp4", // Imagem 6: 100% Gay
  },
];

export default {
  name: "gay",
  description: "Calcula a porcentagem gay de um usuário.",
  commands: ["gay"],
  usage: `${PREFIX}gay @usuario ou respondendo a mensagem`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    sendGifFromFile,
    sendErrorReply,
    replyLid,
    args,
    isReply,
    mentionedLid,
  }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar um membro para calcular a porcentagem gay!"
      );
    }

    // 1. Identificar o alvo (LID)
    // Prioridade: 1. Menção na mensagem, 2. Resposta, 3. Argumento (fallback)
    const targetLid = mentionedLid
      ? mentionedLid
      : isReply
      ? replyLid
      : args[0]
      ? `${onlyNumbers(args[0])}@lid`
      : null;

    if (!targetLid) {
      await sendErrorReply(
        "Não foi possível identificar o usuário. Mencione ou responda a mensagem de alguém."
      );
      return;
    }

    // 2. Normalizar o número do alvo para comparação
    let targetNumber = onlyNumbers(targetLid);

    // Garante que o número tenha o DDI 55, se for um número brasileiro de 11 dígitos (DDD + 9º dígito + 8 dígitos)
    if (targetNumber.length === 11 && targetNumber.startsWith("75")) {
      targetNumber = "55" + targetNumber;
    } else if (targetNumber.length === 11 && targetNumber.startsWith("54")) {
      targetNumber = "55" + targetNumber;
    } else if (targetNumber.length === 11) {
      // Para outros DDDS brasileiros de 11 dígitos
      targetNumber = "55" + targetNumber;
    } else if (targetNumber.length === 10) {
      // Para números brasileiros de 10 dígitos (sem o 9º dígito)
      targetNumber = "55" + targetNumber;
    }

    // 3. Definir as exceções
    const HETERO_NUMBER = "5575983258635";
    const GAY_NUMBER = "555496630919";

    let percentage;

    if (targetNumber === HETERO_NUMBER) {
      percentage = 0;
    } else if (targetNumber === GAY_NUMBER) {
      percentage = 100;
    } else {
      // Gerar porcentagem aleatória (0 a 100)
      percentage = getRandomNumber(0, 100);
    }

    // 4. Encontrar a faixa correspondente
    const range = GAY_RANGES.find(
      (r) => percentage >= r.min && percentage <= r.max
    );

    // 5. Construir a mensagem
    const targetMention = `@${targetNumber}`;

    const messageText = `
*Calculadora Gay* 🏳️‍🌈

${targetMention} é ${percentage}% gay!

*Resultado:* ${range.message}
`;

    // 5. Enviar o GIF e a mensagem com a menção
    const gifPath = path.resolve(ASSETS_DIR, "images", "funny", range.gif);

    await sendGifFromFile(gifPath, messageText, [targetLid]);
  },
};