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
  "18863932580078": "555496630919",
};

const TAXISTA_RANGES = [
   { min: 0, max: 0, message: "Não é Nazista!", gif: "nazi.mp4" },
  { min: 1, max: 20, message: "É quase um Nazista educado! Poupa Judeus", gif: "nazi.mp4" },
  { min: 21, max: 40, message: "Já começa a ter traços de Nazista! Chuta Judeus", gif: "nazi.mp4" },
  { min: 41, max: 60, message: "É Nazista de carteirinha! Ameaça Judeus", gif: "nazi.mp4" },
  { min: 61, max: 80, message: "É Nazista raiz! Perigoso Assassina Judeus", gif: "nazi.mp4" },
  { min: 81, max: 99, message: "É o rei dos Nazistas! Amigo de Hitler", gif: "nazi.mp4" },
  { min: 100, max: 100, message: "É O NAZISTA SUPREMO!! Sentando no colo do capeta", gif: "nazi.mp4" },
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

function calculateTaxistaPercentage(lid) {
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
  name: "nazista",
  description: "Calcula o nível de nazista de um usuário.",
  commands: ["nazista"],
  usage: `${PREFIX}nazista @usuario ou respondendo a mensagem`,
  
  handle: async ({ sendGifFromFile, sendErrorReply, replyLid, args, isReply }) => {
    if (!args.length && !isReply) {
      throw new InvalidParameterError(
        "Você precisa mencionar ou marcar um membro para calcular o nível de nazista!"
      );
    }

    const targetLid = isReply ? replyLid : args[0] ? `${onlyNumbers(args[0])}@lid` : null;

    if (!targetLid) {
      await sendErrorReply(
        "Não foi possível identificar o usuário. Mencione ou responda a mensagem de alguém."
      );
      return;
    }

    const percentage = calculateTaxistaPercentage(targetLid);
    const range = TAXISTA_RANGES.find(r => percentage >= r.min && percentage <= r.max);
    const displayNumber = getDisplayNumber(targetLid);
    
    const messageText = `
*Medidor de nazista comando perigoso*

@${displayNumber} é ${percentage}% nazista!

*Resultado:* ${range.message}
`;

    const gifPath = path.resolve(ASSETS_DIR, "images", "gay", range.gif);
    await sendGifFromFile(gifPath, messageText, [targetLid]);
  },
};