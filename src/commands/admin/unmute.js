/**
 * Desenvolvido por: Mkg
 * Refatorado por: Dev Gui
 *
 * @author Dev Gui
 */
import { PREFIX } from "../../config.js";
import { DangerError, WarningError } from "../../errors/index.js";
import { checkIfMemberIsMuted, unmuteMember } from "../../utils/database.js";
import { onlyNumbers } from "../../utils/index.js";

export default {
  name: "unmute",
  description: "Desativa o mute de um membro do grupo",
  commands: ["unmute", "desmutar"],
  usage: `${PREFIX}unmute @usuario

ou

${PREFIX}unmute (respondendo à mensagem do usuário)`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ 
    remoteJid, 
    sendSuccessReply, 
    args, 
    isGroup, 
    replyLid,
    sendErrorReply 
  }) => {
    if (!isGroup) {
      throw new DangerError("Este comando só pode ser usado em grupos.");
    }

    if (!args.length && !replyLid) {
      throw new DangerError(
        `Você precisa mencionar um usuário ou responder à mensagem do usuário que deseja desmutar.\n\nExemplo: ${PREFIX}unmute @fulano`
      );
    }

    const userId = replyLid
      ? replyLid
      : args[0]
      ? `${onlyNumbers(args[0])}@lid`
      : null;

    const targetUserNumber = onlyNumbers(userId);

    if (!checkIfMemberIsMuted(remoteJid, userId)) {
      return sendErrorReply(
        `O usuário @${targetUserNumber} não está silenciado neste grupo.`,
        [userId]
      );
    }

    unmuteMember(remoteJid, userId);

    await sendSuccessReply(
      `@${targetUserNumber} foi desmutado com sucesso neste grupo!`,
      [userId]
    );
  },
};