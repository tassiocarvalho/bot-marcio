import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import { InvalidParameterError } from "../../../errors/index.js";
import { onlyNumbers, getRandomNumber } from "../../../utils/index.js";

const SPECIAL_NUMBERS = {
  "557583258635": 0,
  "5575983258635": 0,
  "7583258635": 0,
  "75983258635": 0,
  "555496630919": 100,
  "5554996630919": 100,
  "5496630919": 100,
  "54996630919": 100,
};

const LID_TO_PHONE_MAP = {
  "256719003369709": "557583258635",
};

const GAY_RANGES = [
  { min: 0, max: 0, message: "É 100% hetero! 🚫", gif: "hetero.mp4" },
  { min: 1, max: 25, message: "É quase hetero. Ainda há esperança! 🤏", gif: "gay_1.mp4" },
  { min: 26, max: 49, message: "É quase meio gay. Está na dúvida! 🤔", gif: "gay_2.mp4" },
  { min: 50, max: 75, message: "É gay. Orgulho! 🏳️‍🌈", gif: "gay_3.mp4" },
  { min: 76, max: 99, message: "É gayzão! Não tem mais volta! 🌈", gif: "gay_4.mp4" },
  { min: 100, max: 100, message: "É o gay mais gay da terra! 👑", gif: "gay_5.mp4" },
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

function calculateGayPercentage(lid) {
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
  name: "gay",
  description: "Calcula a porcentagem gay de um usuário.",
  commands: ["gay"],
  usage: `${PREFIX}gay @usuario ou respondendo a mensagem`,
  
  handle: async ({ sendGifFromFile, sendErrorReply, replyLid, args, isReply }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar um membro para calcular a porcentagem gay!"
      );
    }

    const targetLid = isReply ? replyLid : args[0] ? `${onlyNumbers(args[0])}@lid` : null;

    if (!targetLid) {
      await sendErrorReply(
        "Não foi possível identificar o usuário. Mencione ou responda a mensagem de alguém."
      );
      return;
    }

    const percentage = calculateGayPercentage(targetLid);
    const range = GAY_RANGES.find(r => percentage >= r.min && percentage <= r.max);
    const displayNumber = getDisplayNumber(targetLid);
    
    const messageText = `
*Calculadora Gay* 🏳️‍🌈

@${displayNumber} é ${percentage}% gay!

*Resultado:* ${range.message}
`;

    const gifPath = path.resolve(ASSETS_DIR, "images", "gay", range.gif);
    await sendGifFromFile(gifPath, messageText, [targetLid]);
  },
};