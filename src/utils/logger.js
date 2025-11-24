/**
 * Logs
 *
 * @author Dev Gui
 */
import pkg from "../../package.json" with { type: "json" };

export function sayLog(message) {
  console.log("\x1b[36m[TAKESHI BOT | TALK]\x1b[0m", message);
}

export function inputLog(message) {
  console.log("\x1b[30m[TAKESHI BOT | INPUT]\x1b[0m", message);
}

export function infoLog(message) {
  console.log("\x1b[34m[TAKESHI BOT | INFO]\x1b[0m", message);
}

export function successLog(message) {
  console.log("\x1b[32m[TAKESHI BOT | SUCCESS]\x1b[0m", message);
}

export function errorLog(message) {
  console.log("\x1b[31m[TAKESHI BOT | ERROR]\x1b[0m", message);
}

export function warningLog(message) {
  console.log("\x1b[33m[TAKESHI BOT | WARNING]\x1b[0m", message);
}

export function bannerLog() {
console.log(` _____ ______   ________  ________  ________  ___  ________                 ________  ________  _________   `);
console.log(`|\\   _ \\  _   \\|\\   __  \\|\\   __  \\|\\   ____\\|\\  \\|\\   __  \\               |\\   __  \\|\\   __  \\|\\___   ___\\ `);
console.log(`\\ \\  \\\\\\__\\ \\  \\ \\  \\|\\  \\ \\  \\|\\  \\ \\  \\___|\\ \\  \\ \\  \\|\\  \\  ____________\\ \\  \\|\\ /\\ \\  \\|\\  \\|___ \\  \\_| `);
console.log(` \\ \\  \\\\|__| \\  \\ \\   __  \\ \\   _  _\\ \\  \\    \\ \\  \\ \\  \\\\\\  \\|\\____________\\ \\   __  \\ \\  \\\\\\  \\   \\ \\  \\  `);
console.log(`  \\ \\  \\    \\ \\  \\ \\  \\ \\  \\ \\  \\\\  \\\\ \\  \\____\\ \\  \\ \\  \\\\\\  \\|____________|\\ \\  \\|\\  \\ \\  \\\\\\  \\   \\ \\  \\ `);
console.log(`   \\ \\__\\    \\ \\__\\ \\__\\ \\__\\ \\__\\\\ _\\\\ \\_______\\ \\__\\ \\_______\\              \\ \\_______\\ \\_______\\   \\ \\__\\`);
console.log(`    \\|__|     \\|__|\\|__|\\|__|\\|__|\\|__|\\|_______|\\|__|\\|_______|               \\|_______|\\|_______|    \\|__|`);
  console.log(`\x1b[36m🤖 Versão: \x1b[0m${pkg.version}\n`);
}
