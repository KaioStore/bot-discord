process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Promise rejeitada:', err);
});

const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const express = require('express');
const cors = require('cors'); // pode deixar aqui

const app = express(); // ⚠️ TEM QUE VIR ANTES DE TUDO QUE USA app

app.use(cors()); // ⚠️ SÓ DEPOIS disso

const app = express();
app.use(cors()); // 🔥 necessário pro site

app.get('/perfil/:id', async (req, res) => {
  const userId = req.params.id;

  let total = gastos[userId] || 0;

  let vip = "Sem cargo";
  if (total >= 1000) vip = "Diamante";
  else if (total >= 500) vip = "Ouro";
  else if (total >= 300) vip = "Prata";
  else if (total >= 100) vip = "Bronze";

  try {
    const user = await client.users.fetch(userId);

    return res.json({
      nome: user.username,
      avatar: user.displayAvatarURL({ dynamic: true, size: 512 }),
      total: total,
      vip: vip,
      posicao: Object.entries(gastos)
        .sort((a, b) => b[1] - a[1])
        .findIndex(([id]) => id === userId) + 1
    });

  } catch {
    return res.json({ erro: true });
  }
});

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== BANCO AVALIAÇÕES =====
let db = { total: 419, pedidos: 450 };

try {
  if (fs.existsSync('./db.json')) {
    db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
  }
} catch {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

function salvar() {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

// ===== BANCO GASTOS =====
let gastos = {};

try {
  if (fs.existsSync('./gastos.json')) {
    const conteudo = fs.readFileSync('./gastos.json', 'utf8');
    gastos = conteudo ? JSON.parse(conteudo) : {};
  }
} catch {
  gastos = {};
  fs.writeFileSync('./gastos.json', '{}');
}

function salvarGastos() {
  fs.writeFileSync('./gastos.json', JSON.stringify(gastos, null, 2));
}

// ===== API PRO SITE (NÃO REMOVE ISSO) =====
app.get('/perfil/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const user = await client.users.fetch(id);
    const total = gastos[id] || 0;

    let vip = null;
    if (total >= 1000) vip = 'Diamante';
    else if (total >= 500) vip = 'Ouro';
    else if (total >= 300) vip = 'Prata';
    else if (total >= 100) vip = 'Bronze';

    const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);
    const posicao = ranking.findIndex(u => u[0] === id) + 1;

    res.json({
      nome: user.username,
      avatar: user.displayAvatarURL({ dynamic: true }),
      total,
      vip,
      posicao: posicao || null
    });

  } catch {
    res.json({ erro: true });
  }
});

app.listen(3000, () => {
  console.log('Web server ligado');
});

// ===== BOT ONLINE =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  try {

    // ===== AVALIAR =====
    if (interaction.commandName === 'avaliar') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Só administradores podem usar esse comando.', ephemeral: true });
      }

      const texto = interaction.options.getString('texto');

      if (!texto || texto.length < 5) {
        return interaction.reply({
          content: 'Você precisa escrever uma avaliação válida.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      db.total += 1;
      db.pedidos += 1;
      salvar();

      // 🔥 SEU EMBED ORIGINAL BONITO
      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('**Avaliação Recebida! 🖤**')
        .setThumbnail('https://cdn.discordapp.com/attachments/1411723762260508702/1473016671240323103/Design_sem_nome.png')
        .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
        .setDescription(
`**•** **Avaliação:** ${texto}
**•** **Total de avaliações:** ${db.total}
**•** **Pedido:** ${db.pedidos}

Esta avaliação foi registrada de forma **anônima**, devido ao sistema de banimento do **FLEE THE FACILITY**, prezamos pelo máximo de segurança possível dos nossos **clientes!**`
        );

      const canal = client.channels.cache.get(CANAL_AVALIACOES);

      if (!canal) {
        return interaction.editReply('Canal não encontrado.');
      }

      await canal.send({ embeds: [embed] });

      return interaction.editReply('Avaliação enviada com sucesso.');
    }

    // ===== GASTAR =====
    if (interaction.commandName === 'gastar') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Só administradores podem usar esse comando.', ephemeral: true });
      }

      const user = interaction.options.getUser('usuario');
      const valor = interaction.options.getNumber('valor');

      if (!gastos[user.id]) gastos[user.id] = 0;
      gastos[user.id] += valor;

      salvarGastos();

      return interaction.reply({
        content: `💸 Gasto adicionado para ${user.username}.`,
        ephemeral: true
      });
    }

    // ===== REMOVER GASTO =====
    if (interaction.commandName === 'removergasto') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Só administradores podem usar esse comando.', ephemeral: true });
      }

      const user = interaction.options.getUser('usuario');
      const valor = interaction.options.getNumber('valor');

      if (!gastos[user.id]) gastos[user.id] = 0;

      gastos[user.id] -= valor;

      if (gastos[user.id] <= 0) {
        delete gastos[user.id];
      }

      salvarGastos();

      return interaction.reply({
        content: `💸 Gasto removido de ${user.username}.`,
        ephemeral: true
      });
    }

    // ===== RANK =====
    if (interaction.commandName === 'rank') {

      const ranking = Object.entries(gastos)
        .sort((a, b) => b[1] - a[1]);

      const porPagina = 10;
      let pagina = 0;

      async function gerarEmbed(p) {
        const totalPaginas = Math.max(1, Math.ceil(ranking.length / porPagina));
        const inicio = p * porPagina;
        const dados = ranking.slice(inicio, inicio + porPagina);

        let texto = '';

        for (let i = 0; i < dados.length; i++) {
          const userId = dados[i][0];
          const valor = dados[i][1];
          const pos = inicio + i + 1;

          let medalha = `${pos}.`;
          if (pos === 1) medalha = '🥇';
          else if (pos === 2) medalha = '🥈';
          else if (pos === 3) medalha = '🥉';

          let username = 'Usuário';
          try {
            const user = await client.users.fetch(userId);
            username = user.username;
          } catch {}

          const link = `https://kaio-rank.vercel.app/?id=${userId}`;

          texto += `${medalha} [${username}](${link})\n💰 Total: R$${valor}\n\n`;
        }

        texto += `> Continue comprando para subir no ranking e ganhar benefícios!`;

        return new EmbedBuilder()
          .setTitle('Top Clientes')
          .setColor('#2b2d31')
          .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
          .setDescription(texto)
          .setFooter({ text: `Página ${p + 1}/${totalPaginas}` });
      }

      const row = {
        type: 1,
        components: [
          { type: 2, style: 2, label: '‹ Anterior', custom_id: 'anterior' },
          { type: 2, style: 2, label: 'Próximo ›', custom_id: 'proximo' }
        ]
      };

      const msg = await interaction.reply({
        embeds: [await gerarEmbed(pagina)],
        components: [row],
        fetchReply: true
      });

      const collector = msg.createMessageComponentCollector({ time: 600000 });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'Só você pode usar.', ephemeral: true });
        }

        const totalPaginas = Math.ceil(ranking.length / porPagina);

        if (i.customId === 'anterior' && pagina > 0) pagina--;
        if (i.customId === 'proximo' && pagina < totalPaginas - 1) pagina++;

        await i.update({
          embeds: [await gerarEmbed(pagina)],
          components: [row]
        });
      });
    }

  } catch (err) {
    console.error(err);

    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: 'Erro ao executar.', ephemeral: true });
    } else {
      interaction.reply({ content: 'Erro ao executar.', ephemeral: true });
    }
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);
