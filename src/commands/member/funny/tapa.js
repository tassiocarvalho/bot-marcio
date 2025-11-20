import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";

export default {
  name: "tapa",
  description: "Dá um tapa em alguém.",
  commands: ["tapa"],
  usage: `${PREFIX}tapa @usuario`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
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

if (command === "listadegados") {
    if (!isGroup) return reply("❌ Esse comando só funciona em grupos.");

    const participantes = groupMetadata.participants.map(p => p.id);

    if (participantes.length < 5)
        return reply("O grupo não tem membros suficientes para montar a lista.");

    // embaralha os membros
    const embaralhados = participantes.sort(() => Math.random() - 0.5);

    // seleciona os 5 primeiros
    const selecionados = embaralhados.slice(0, 5);

    let texto = "======= Lista de Gados =======\n\n";
    texto += selecionados.map(u => `@${u.split("@")[0]}`).join("\n");

    conn.sendMessage(from, {
        text: texto,
        mentions: selecionados
    });
}
