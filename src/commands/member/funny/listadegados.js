const command = {
    name: "listadegados",
    aliases: ["gadolist", "gados"],
    execute: async (client, message) => {  // Assumindo params padrão do Takeshi: client, message
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            return client.sendMessage(remoteJid, { text: '❌ Só em grupos, brother!' }, { quoted: message });
        }

        try {
            const groupMeta = await client.groupMetadata(remoteJid);
            let members = groupMeta.participants;
            
            // Filtro simples: remove bot e inválidos
            members = members.filter(m => m.id !== client.user?.id && m.id.endsWith('@s.whatsapp.net'));
            
            if (members.length < 5) {
                return client.sendMessage(remoteJid, { text: '❌ Grupo precisa de 5+ membros pra zuera!' }, { quoted: message });
            }
            
            // Sorteio: embaralha e pega 5
            for (let i = members.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [members[i], members[j]] = [members[j], members[i]];
            }
            const gados = members.slice(0, 5);
            
            let text = '═════ ⋆★⋆ ═════\n   🐄 *LISTA DE GADOS* 🐄\n═════ ⋆★⋆ ═════\n\n';
            const mentions = [];
            
            gados.forEach((m, i) => {
                const nome = m.pushname || m.notify || 'Gado Sem Nome';
                const num = m.id.split('@')[0];
                text += `${i+1}º ➤ @${num}\n   ├ ${nome}\n   └ *Gado elite* 🐂\n\n`;
                mentions.push(m.id);
            });
            
            text += '💔 Chora gado, deve rodada! 😭';
            
            client.sendMessage(remoteJid, { text, mentions }, { quoted: message });
        } catch (e) {
            console.log('Erro listadegados:', e);  // Log pro debug
            client.sendMessage(remoteJid, { text: '❌ Erro no sorteio... Tenta de novo!' }, { quoted: message });
        }
    }
};

export default command;