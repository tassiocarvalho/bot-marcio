/**
 * Logs
 *
 * @author MARCIO
 */
import pkg from "../../package.json" with { type: "json" };

export function sayLog(message) {
  console.log("\x1b[36m[TASSIO BOT | TALK]\x1b[0m", message);
}

export function inputLog(message) {
  console.log("\x1b[30m[TASSIO BOT | INPUT]\x1b[0m", message);
}

export function infoLog(message) {
  console.log("\x1b[34m[TASSIO BOT | INFO]\x1b[0m", message);
}

export function successLog(message) {
  console.log("\x1b[32m[TASSIO BOT | SUCCESS]\x1b[0m", message);
}

export function errorLog(message) {
  console.log("\x1b[31m[TASSIO BOT | ERROR]\x1b[0m", message);
}

export function warningLog(message) {
  console.log("\x1b[33m[TASSIO BOT | WARNING]\x1b[0m", message);
}

export function bannerLog() {
console.log("        ,----,                                                         ");
console.log("      ,/   .`|                                              ,----..    ");
console.log("    ,`   .'  : ,---,       .--.--.    .--.--.      ,---,   /   /   \\   ");
console.log("  ;    ;     /'  .' \\     /  /    '. /  /    '. ,`--.' |  /   .     :  ");
console.log(".\'___,/    ,'/  ;    '.  |  :  /`. /|  :  /`. / |   :  : .   /   ;.  \\ ");
console.log("|    :     |:  :       \\ ;  |  |--` ;  |  |--`  :   |  '.   ;   /  ` ; ");
console.log(";    |.';  ;:  |   /\\   \\|  :  ;_   |  :  ;_    |   :  |;   |  ; \\ ; | ");
console.log("`----'  |  ||  :  ' ;.   :\\  \\    `. \\  \\    `. '   '  ;|   :  | ; | ' ");
console.log("    '   :  ;|  |  ;/  \\   \\`----.   \\ `----.   \\|   |  |.   |  ' ' ' : ");
console.log("    |   |  ''  :  | \\  \\ ,'__ \\  \\  | __ \\  \\  |'   :  ;'   ;  \\; /  | ");
console.log("    '   :  ||  |  '  '--' /  /`--'  //  /`--'  /|   |  ' \\   \\  ',  /  ");
console.log("    ;   |.' |  :  :      '--'.     /'--'.     / '   :  |  ;   :    /   ");
console.log("    '---'   |  | ,'        `--'---'   `--'---'  ;   |.'    \\   \\ .'    ");
console.log("            `--''                               '---'       `---`      ");
console.log("                                                                       ");
console.log("                                                                       ");
  console.log(`\x1b[36m🤖 Versão: \x1b[0m${pkg.version}\n`);
}
