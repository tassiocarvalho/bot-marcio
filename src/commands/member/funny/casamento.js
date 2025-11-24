import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers } from "../../../utils/index.js";

const IMMUNE_NUMBERS = {
  "557583258635": true,
  "5575983258635": true,
  "7583258635": true,
  "75983258635": true,
};

const LID_TO_PHONE_MAP = {
  "256719003369709": "557583258635",
};

function getRealPhoneNumber(lid) {
  const cleanLid = onlyNumbers(lid);
  
  if (cleanLid in LID_TO_PHONE_MAP) {
    return LID_TO_PHONE_MAP[cleanLid];
  }
  
  return cleanLid;
}

function getAllNumberVariations(phoneNumber) {
  const variations = new Set();
  
  variations.add(phoneNumber);
  
  if (!phoneNumber.startsWith("55") && (phoneNumber.length === 10 || phoneNumber.length === 11)) {
    variations.add("55" + phoneNumber);
  }
  
  if (phoneNumber.startsWith("55") && phoneNumber.length >= 12) {
    variations.add(phoneNumber.substring(2));
  }
  
  const allVariations = Array.from(variations);
  allVariations.forEach(variant => {
    if (variant.length === 11 && variant.charAt(2) === "9") {
      variations.add(variant.substring(0, 2) + variant.substring(3));
    }
    if (variant.length === 13 && variant.startsWith("55") && variant.charAt(4) === "9") {
      variations.add(variant.substring(0, 4) + variant.substring(5));
    }
  });
  
  return Array.from(variations);
}

function isImmune(lid) {
  const realPhone = getRealPhoneNumber(lid);
  const variations = getAllNumberVariations(realPhone);
  
  for (const variant of variations) {
    if (variant in IMMUNE_NUMBERS) {
      return true;
    }
  }
  
  return false;
}

export default {
  name: "casamento",
  description: "Casa com alguém.",
  commands: ["casamento"],
  usage: `${PREFIX}casamento @usuario ou respondendo a mensagem`,
  
  handle: async ({ sendGifFromFile, sendErrorReply, sendReply, replyLid, args, isReply, userLid }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar alguém para casar!"
      );
    }

    const targetLid = isReply ? replyLid : args[0] ? `${onlyNumbers(args[0])}@lid` : null;

    if (!targetLid) {
      await sendErrorReply(
        "Não foi possível identificar o usuário. Mencione ou responda a mensagem de alguém."
      );
      return;
    }

    if (isImmune(targetLid)) {
      const targetNumber = onlyNumbers(targetLid);
      await sendReply(`@${targetNumber} é imune a casamentos! 🛡️✨`);
      return;
    }

    const senderNumber = onlyNumbers(userLid);
    const targetNumber = onlyNumbers(targetLid);
    
    const messageText = `
*Casamento* 💍💒

@${senderNumber} se casou com @${targetNumber}!

🎉 *Felicidades ao casal!* 🎉
`;

    const gifPath = path.resolve(ASSETS_DIR, "images", "casar", "casar.mp4");
    await sendGifFromFile(gifPath, messageText, [userLid, targetLid]);
  },
};