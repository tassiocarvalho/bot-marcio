import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers, getRandomNumber } from "../../../utils/index.js";

const SPECIAL_NUMBERS = {
  "557583258635": 100,
  "5575983258635": 100,
  "7583258635": 100,
  "75983258635": 100,
  "555496630919": 0,
  "5554996630919": 0,
  "5496630919": 0,
  "54996630919": 0,
};

const LID_TO_PHONE_MAP = {
  "256719003369709": "557583258635",
  "18863932580078": "555496630919",
};

const GOSTOSO_RANGES = [
  { min: 0, max: 0, message: "É feio pra caralho! 🤮", gif: "feio.mp4" },
  { min: 1, max: 20, message: "É bem feiozinho! 😬", gif: "gostoso_1.mp4" },
  { min: 21, max: 40, message: "É mais ou menos... 😐", gif: "gostoso_2.mp4" },
  { min: 41, max: 60, message: "É bonitinho! 😊", gif: "gostoso_3.mp4" },
  { min: 61, max: 80, message: "É gostoso! 🔥", gif: "gostoso_4.mp4" },
  { min: 81, max: 99, message: "É gostoso demais! 😍🔥", gif: "gostoso_5.mp4" },
  { min: 100, max: 100, message: "É O MAIS GOSTOSO DO MUNDO! 😍🔥👑", gif: "gostoso_6.mp4" },
];

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

function calculateGostosoPercentage(lid) {
  const realPhone = getRealPhoneNumber(lid);
  const variations = getAllNumberVariations(realPhone);
  
  for (const variant of variations) {
    if (variant in SPECIAL_NUMBERS) {
      return SPECIAL_NUMBERS[variant];
    }
  }
  
  return getRandomNumber(0, 100);
}

function getDisplayNumber(lid) {
  const realPhone = getRealPhoneNumber(lid);
  const variations = getAllNumberVariations(realPhone);
  const withDDI = variations.find(v => v.startsWith("55") && v.length >= 12);
  return withDDI || variations[0];
}

export default {
  name: "gostoso",
  description: "Calcula o nível de gostosura de um usuário.",
  commands: ["gostoso", "gostosa"],
  usage: `${PREFIX}gostoso @usuario ou respondendo a mensagem`,
  
  handle: async ({ sendGifFromFile, sendErrorReply, replyLid, args, isReply }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar um membro para calcular o nível de gostosura!"
      );
    }

    const targetLid = isReply ? replyLid : args[0] ? `${onlyNumbers(args[0])}@lid` : null;

    if (!targetLid) {
      await sendErrorReply(
        "Não foi possível identificar o usuário. Mencione ou responda a mensagem de alguém."
      );
      return;
    }

    const percentage = calculateGostosoPercentage(targetLid);
    const range = GOSTOSO_RANGES.find(r => percentage >= r.min && percentage <= r.max);
    const displayNumber = getDisplayNumber(targetLid);
    
    const messageText = `
*Medidor de Gostosura* 🔥

@${displayNumber} é ${percentage}% gostoso(a)!

*Resultado:* ${range.message}
`;

    const gifPath = path.resolve(ASSETS_DIR, "images", "gostoso", range.gif);
    await sendGifFromFile(gifPath, messageText, [targetLid]);
  },
};