// src/commands/member/funny/listadegados.js
import { getGroupMembers } from '../../utils/loadCommonFunctions.js';

const command = {
    name: "listadegados",
    description: "Sorteia 5 gados aleatórios do grupo (brincadeira)",
    aliases: ["gadolist", "gados", "listagado"],
    cooldown: 15, // 15 segundos de cooldown pra não floodar

    async execute(client, message, args) {
        const { remoteJid, participant } = message.key;
        const isGroup = remoteJid.endsWith('@g.us');

        if (!isGroup) {
            return client.sendMessage(remoteJid, { text: "❌ Esse comando só funciona em grupos!" }, { quoted: message });
        }

        try {
            // Pega todos os participantes do grupo
            const members = await getGroupMembers(remoteJid, client);

            // Remove o próprio bot da lista
            const realMembers = members.filter(m => !m.id.includes('lid') && m.id !== client.user.id);

            if (realMembers.length < 5) {
                return client.sendMessage(remoteJid, { 
                    text: "❌ O grupo precisa ter pelo menos 5 membros (sem contar o bot) pra fazer a lista de gado!" 
                }, { quoted: message });
            }

            // Embaralha e pega 5 aleatórios
            const shuffled = realMembers.sort(() => 0.5 - Math.random());
            const gados = shuffled.slice(0, 5);

            // Monta a lista bonita
            let texto = "═════ ⋆★⋆ ═════\n";
            texto += "   🐄 *LISTA DE GADOS* 🐄\n";
            texto += "═════ ⋆★⋆ ═════\n\n";

            gados.forEach((gado, index) => {
                const nome = gado.pushName || gado.verifiedName || "Sem Nome";
                const numero = gado.id.split('@')[0];
                texto += `${index + 1}º ➤ @${numero}\n`;
                texto += `    ├ Nome: ${nome}\n`;
                texto += `    └ Status: *Gado nível máximo* 🐂\n\n`;
            });

            texto += "💔 *Chora na moral, gado!* 😭";

            // Menciona os 5 gados sorteados
            const mentions = gados.map(g => g.id);

            await client.sendMessage(remoteJid, {
                text: texto,
                mentions: mentions
            }, { quoted: message });

        } catch (err) {
            console.log(err);
            await client.sendMessage(remoteJid, { 
                text: "❌ Deu ruim na hora de sortear os gados... tenta de novo!" 
            }, { quoted: message });
        }
    }
};

export default command;