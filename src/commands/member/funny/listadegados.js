/*import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";

export default {
  name: "listadegados",
  description: "Diga q o fdpt é gado",
  commands: ["listadegados"],
  usage: `${PREFIX}listadegados @usuario`,
  /**
   * @param {CommandHandleProps} props
   */

/*  handle: async ({
    sendGifFromFile,
    sendErrorReply,
    userLid,
    replyLid,
    args,
    isReply,
  }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar um membro!"
      );
    }

    const targetLid = isReply
      ? replyLid
      : args[0]
      ? `${onlyNumbers(args[0])}@lid`
      : null;

    if (!targetLid) {
      await sendErrorReply(
        "Você precisa mencionar um usuário ou responder uma mensagem para dar um tapa."
      );

      return;
    }

    const userNumber = onlyNumbers(userLid);
    const targetNumber = onlyNumbers(targetLid);

    await sendGifFromFile(
      path.resolve(ASSETS_DIR, "images", "funny", "slap-jjk.mp4"),
      `@${userNumber} deu um tapa na cara de @${targetNumber}!`,
      [userLid, targetLid]
    );
  },
};
*/

import { PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";

/**
 * Função para selecionar N elementos aleatórios de um array.
 * @param {Array} array
 * @param {number} n
 * @returns {Array}
 */
function getRandomElements(array, n) {
  // Embaralha o array e pega os primeiros N elementos
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

export default {
  name: "listadegados",
  description: "Seleciona 5 membros aleatórios do grupo e os lista como 'gados'.",
  commands: ["listadegados"],
  usage: `${PREFIX}listadegados`,

  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ sendReply, participants }) => {
    // Verifica se há participantes suficientes no grupo
    if (!participants || participants.length < 5) {
      throw new InvalidParameterError(
        "Este comando só pode ser usado em grupos com pelo menos 5 membros."
      );
    }

    // 1. Selecionar 5 membros aleatórios
    const gadosSelecionados = getRandomElements(participants, 5);

    // 2. Mapear os LIDs dos membros para a lista de menções
    const gadosLids = gadosSelecionados.map((m) => m.id);

    // 3. Criar a mensagem formatada
    const mensagem = `
*======= Lista de Gados =======*

${gadosLids
  .map((lid, index) => `${index + 1}. @${onlyNumbers(lid)}`)
  .join("\n")}

==============================
`;

    // 4. Enviar a mensagem com as menções
    // O objeto { mentions: gadosLids } garante que o WhatsApp renderize as menções corretamente.
    await sendReply(mensagem, { mentions: gadosLids });
  },
};
