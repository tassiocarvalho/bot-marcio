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
    gif: "sung-jin-woo-jinwoo.mp4", // Imagem 1: Hetero
  },
  {
    min: 1,
    max: 25,
    message: "É quase hetero. Ainda há esperança! 🤏",
    gif: "gintama-gintoki.mp4", // Imagem 2: Quase Hetero
  },
  {
    min: 26,
    max: 49,
    message: "É quase meio gay. Está na dúvida! 🤔",
    gif: "some-guy-getting-punch-anime-punching-some-guy-anime.mp4", // Imagem 3: Quase Meio Gay
  },
  {
    min: 50,
    max: 75,
    message: "É gay. Orgulho! 🏳️‍🌈",
    gif: "hug-darker-than-black.mp4", // Imagem 4: Gay
  },
  {
    min: 76,
    max: 99,
    message: "É gayzão! Não tem mais volta! 🌈",
    gif: "kiss.mp4", // Imagem 5: Gayzão
  },
  {
    min: 100,
    max: 100,
    message: "É o gay mais gay da terra! 👑",
    gif: "yumeko-mirai-nikki.mp4", // Imagem 6: 100% Gay
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
  }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar um membro para calcular a porcentagem gay!"
      );
    }

    // 1. Identificar o alvo (LID)
    const targetLid = isReply
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

    // 2. Gerar porcentagem aleatória (0 a 100)
    const percentage = getRandomNumber(0, 100);

    // 3. Encontrar a faixa correspondente
    const range = GAY_RANGES.find(
      (r) => percentage >= r.min && percentage <= r.max
    );

    // 4. Construir a mensagem
    const targetNumber = targetLid.split("@")[0];
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