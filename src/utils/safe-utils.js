/**
 * Remove todos os caracteres que não são números de uma string.
 * Retorna uma string vazia se a entrada não for uma string válida.
 * @param {string} text - A string a ser processada.
 * @returns {string} A string contendo apenas números.
 */
export function onlyNumbers(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text.replace(/[^0-9]/g, "");
}
