process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Promise rejeitada:', err);
});

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== SISTEMA EMBED (ADICIONADO) =====
let embedsTemp = {};

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

// ===== API =====
app.get('/perfil/:id', async (req, res) => {
  const id = req.params.id;

  if (!client.isReady()) {
    return setTimeout(() => {
      res.redirect(`/perfil/${req.params.id}`);
    }, 2000);
  }

  try {
    const user = await client.users.fetch(id);
    const total = gastos[id] || 0;

    let vip = "Sem cargo";
    if (total >= 1000) vip = "Diamante";
    else if (total >= 500) vip = "Ouro";
    else if (total >= 300) vip = "Prata";
    else if (total >= 100) vip = "Bronze";

    const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);
    const posicao = ranking.findIndex(u => u[0] === id) + 1;

    res.json({
      nome: user.username,
      avatar: user.displayAvatarURL({ dynamic: true, size: 512 }),
      total,
      vip,
      posicao: posicao || null
    });

  } catch {
    res.json({ erro: true });
  }
});

app.get('/ranking', async (req, res) => {
  try {
    const ranking = Object.entries(gastos)
      .sort((a, b) => b[1] - a[1]);

    const lista = [];

    for (let i = 0; i < ranking.length; i++) {
      const userId = ranking[i][0];
      const total = ranking[i][1];

      let nome = "Usuário";

      try {
        const user = await client.users.fetch(userId);
        nome = user.username;
      } catch {}

      lista.push({
        id: userId,
        nome,
        total
      });
    }

    res.json(lista);

  } catch {
    res.json([]);
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

  // ===== BOTÕES EMBED =====
  if (interaction.isButton()) {

    const data = embedsTemp[interaction.user.id];
    if (!data) return;

    if (interaction.customId === 'titulo') {
      data.title = 'Título editado ✔';
    }

    if (interaction.customId === 'desc') {
      data.description = 'Descrição editada ✔';
    }

    if (interaction.customId === 'cor') {
      data.color = '#5865F2';
    }

    if (interaction.customId === 'reset') {
      data.title = 'Título';
      data.description = 'Descrição';
      data.color = '#2b2d31';
    }

    if (interaction.customId === 'enviar') {

      const embedFinal = new EmbedBuilder()
        .setTitle(data.title)
        .setDescription(data.description)
        .setColor(data.color);

      await interaction.channel.send({ embeds: [embedFinal] });

      return interaction.update({
        content: 'Embed enviado com sucesso!',
        embeds: [],
        components: []
      });
    }

    const embedAtualizado = new EmbedBuilder()
      .setTitle(data.title)
      .setDescription(data.description)
      .setColor(data.color);

    return interaction.update({
      embeds: [embedAtualizado]
    });
  }

  if (!interaction.isChatInputCommand()) return;

  try {

    // ===== SALDO =====
    if (interaction.commandName === 'saldo') {

      const user = interaction.options.getUser('usuario') || interaction.user;
      const total = gastos[user.id] || 0;

      let vip = "Sem cargo";
      if (total >= 1000) vip = "Diamante";
      else if (total >= 500) vip = "Ouro";
      else if (total >= 300) vip = "Prata";
      else if (total >= 100) vip = "Bronze";

      return interaction.reply({
        content: `💰 ${user.username} gastou: R$${total}\n🏆 VIP: ${vip}`,
        ephemeral: true
      });
    }

    // ===== EMBED (RIO STYLE) =====
    if (interaction.commandName === 'embed') {

      embedsTemp[interaction.user.id] = {
        title: 'Título',
        description: 'Descrição',
        color: '#2b2d31'
      };

      const embed = new EmbedBuilder()
        .setTitle('Título')
        .setDescription('Descrição')
        .setColor('#2b2d31');

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cor').setLabel('Cor').setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('reset').setLabel('Resetar').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        ephemeral: true
      });
    }

    // ===== AVALIAR =====
    if (interaction.commandName === 'avaliar') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Só administradores podem usar esse comando.', ephemeral: true });
      }

      const texto = interaction.options.getString('texto');

      await interaction.deferReply({ ephemeral: true });

      db.total++;
      db.pedidos++;
      salvar();

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('**Avaliação Recebida! 🖤**')
        .setThumbnail('https://cdn.discordapp.com/attachments/1411723762260508702/1473016671240323103/Design_sem_nome.png')
        .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
        .setDescription(
`**•** Avaliação: ${texto}
**•** Total: ${db.total}
**•** Pedido: ${db.pedidos}`
        );

      const canal = client.channels.cache.get(CANAL_AVALIACOES);
      if (canal) canal.send({ embeds: [embed] });

      return interaction.editReply('Avaliação enviada.');
    }

    // ===== GASTAR =====
    if (interaction.commandName === 'gastar') {

      const user = interaction.options.getUser('usuario');
      const valor = interaction.options.getNumber('valor');

      if (!gastos[user.id]) gastos[user.id] = 0;
      gastos[user.id] += valor;

      salvarGastos();

      return interaction.reply({
        content: `Gasto adicionado para ${user.username}`,
        ephemeral: true
      });
    }

    // ===== REMOVER GASTO =====
    if (interaction.commandName === 'removergasto') {

      const user = interaction.options.getUser('usuario');
      const valor = interaction.options.getNumber('valor');

      if (!gastos[user.id]) gastos[user.id] = 0;

      gastos[user.id] -= valor;

      if (gastos[user.id] <= 0) delete gastos[user.id];

      salvarGastos();

      return interaction.reply({
        content: `Gasto removido de ${user.username}`,
        ephemeral: true
      });
    }

    // ===== RANK =====
    if (interaction.commandName === 'rank') {

      await interaction.deferReply();

      const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);

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

      const msg = await interaction.editReply({
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
