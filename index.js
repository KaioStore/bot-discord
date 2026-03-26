// (SEU CÓDIGO TODO IGUAL, SÓ COM CORREÇÃO FINAL)

process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Promise rejeitada:', err);
});

const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot online!');
});

// API PERFIL (mantida igual)
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

    const ranking = Object.entries(gastos)
      .sort((a, b) => b[1] - a[1]);

    const posicao = ranking.findIndex(u => u[0] === id) + 1;

    res.json({
      nome: user.username,
      avatar: user.displayAvatarURL({ dynamic: true }),
      total: total,
      vip: vip,
      posicao: posicao || null
    });

  } catch {
    res.json({ erro: true });
  }
});

app.listen(3000, () => {
  console.log('Web server ligado');
});

// CONFIG
const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// BANCO AVALIAÇÕES (SEU ORIGINAL)
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

// BANCO GASTOS
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

// CARGOS (SEU ORIGINAL)
const cargos = {
  bronze: { id: '1485350377846079589', nome: 'Bronze', emoji: '🥉', min: 100 },
  prata: { id: '1485350925286506566', nome: 'Prata', emoji: '🥈', min: 300 },
  ouro: { id: '1485351014516396134', nome: 'Ouro', emoji: '🥇', min: 500 },
  diamante: { id: '1485351087895482608', nome: 'Diamante', emoji: '💎', min: 1000 }
};

async function atualizarCargos(member, total, interaction) {
  if (!member) return;

  let cargoAtual = null;

  if (total >= 1000) cargoAtual = cargos.diamante;
  else if (total >= 500) cargoAtual = cargos.ouro;
  else if (total >= 300) cargoAtual = cargos.prata;
  else if (total >= 100) cargoAtual = cargos.bronze;

  for (const c of Object.values(cargos)) {
    if (member.roles.cache.has(c.id)) {
      await member.roles.remove(c.id).catch(() => {});
    }
  }

  if (!cargoAtual) return;

  await member.roles.add(cargoAtual.id).catch(() => {});
}

// BOT ONLINE
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: 'Kaio Store', type: 0 }],
    status: 'online'
  });
});

// COMANDOS
client.on('interactionCreate', async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  try {

    // 🔥 AVALIAR (SEU ORIGINAL)
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

    // GASTAR
    if (interaction.commandName === 'gastar') {

      const user = interaction.options.getUser('usuario');
      const valor = interaction.options.getNumber('valor');

      if (!gastos[user.id]) gastos[user.id] = 0;
      gastos[user.id] += valor;

      const member = await interaction.guild.members.fetch(user.id);
      await atualizarCargos(member, gastos[user.id], interaction);

      salvarGastos();

      return interaction.reply({
        content: `💸 Gasto adicionado para ${user.username}.`,
        ephemeral: true
      });
    }

    // REMOVER
    if (interaction.commandName === 'removergasto') {

      const user = interaction.options.getUser('usuario');
      const valor = interaction.options.getNumber('valor');

      if (!gastos[user.id]) gastos[user.id] = 0;

      gastos[user.id] -= valor;

      if (gastos[user.id] <= 0) {
        delete gastos[user.id];
      }

      const member = await interaction.guild.members.fetch(user.id);
      await atualizarCargos(member, gastos[user.id] || 0, interaction);

      salvarGastos();

      return interaction.reply({
        content: `💸 Gasto removido de ${user.username}.`,
        ephemeral: true
      });
    }

    // RANK (SEU ORIGINAL)
    if (interaction.commandName === 'rank') {

      await interaction.deferReply();

      const ranking = Object.entries(gastos)
        .sort((a, b) => b[1] - a[1]);

      let texto = '';

      for (let i = 0; i < ranking.length; i++) {
        const userId = ranking[i][0];
        const valor = ranking[i][1];

        texto += `\n> Continue comprando para subir no ranking e ganhar benefícios!`;

        const link = `https://kaio-rank.vercel.app/?id=${userId}`;

        const user = await client.users.fetch(userId).catch(() => null);
        const nome = user ? `[${user.username}](${link})` : 'Usuário';

        texto += `**${i + 1}.** ${nome}\n💰 R$${valor}\n\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle('Top Clientes')
        .setDescription(texto)
        .setColor('#2b2d31');

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (err) {
    console.error(err);

    if (interaction.deferred || interaction.replied) {
      interaction.editReply({ content: 'Erro ao executar comando.' }).catch(() => {});
    } else {
      interaction.reply({ content: 'Erro ao executar comando.', ephemeral: true }).catch(() => {});
    }
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);
