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

    // ===== RANK COMPLETO (COM BOTÕES + LINK + MENÇÃO)
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

    if (dados.length === 0) {
      texto = 'Ainda não há ninguém no ranking.';
    } else {
      for (let i = 0; i < dados.length; i++) {
        const userId = dados[i][0];
        const valor = dados[i][1];

        const pos = inicio + i + 1;

        // 🏆 medalha
        let medalha = `${pos}.`;
        if (pos === 1) medalha = '🥇';
        else if (pos === 2) medalha = '🥈';
        else if (pos === 3) medalha = '🥉';

        // 🔥 menção real
        let nome = `<@${userId}>`;
        try {
          const member = await interaction.guild.members.fetch(userId);
          nome = member.toString();
        } catch {}

        // 🔗 link clicável (nome azul)
        const link = `https://kaio-rank.vercel.app/?id=${userId}`;

        texto += `${medalha} [${nome}](${link})\n💰 Total: **R$${valor}**\n\n`;
      }
    }

    texto += `> Continue comprando para subir no ranking e ganhar benefícios!`;

    return new EmbedBuilder()
      .setTitle('Top Clientes')
      .setDescription(texto)
      .setColor('#2b2d31')
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
      return i.reply({ content: 'Só quem executou pode usar.', ephemeral: true });
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
});

client.login(TOKEN);
setInterval(() => {}, 1000);
