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

export default {
  name: "listadegados",
  description: "Seleciona aleatoriamente 5 gados do grupo",
  commands: ["listadegados"],
  usage: `${PREFIX}listadegados`,

  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ sendMessage, groupMembers, groupId }) => {

    if (!groupMembers || !groupMembers.length) {
      throw new InvalidParameterError("Este comando só pode ser usado em grupos.");
    }

    // seleciona apenas usuários válidos
    const membros = groupMembers.map(m => m.id);

    // embaralhar os membros
    const sorteados = membros
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    const mensagem = 
`======= Lista de Gados =======

${sorteados.map(m => `@${m.split("@")[0]}`).join("\n")}
`;

    await sendMessage(groupId, {
      text: mensagem,
      mentions: sorteados
    });
  },
};
