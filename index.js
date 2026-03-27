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
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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
  if (!client.isReady()) {
    return setTimeout(() => res.redirect('/ranking'), 2000);
  }

  try {
    const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);
    const lista = [];

    for (let i = 0; i < ranking.length; i++) {
      const userId = ranking[i][0];
      const total = ranking[i][1];

      let nome = "Usuário";

      try {
        const user = await client.users.fetch(userId);
        nome = user.username;
      } catch {}

      lista.push({ id: userId, nome, total });
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

// ===== EMBED SYSTEM =====
const embedSessions = {};

function gerarEmbed(data) {
  return new EmbedBuilder()
    .setTitle(data.title || null)
    .setDescription(data.description || "Abra um painel interativo de criação de embeds")
    .setColor(data.color || '#2b2d31');
}

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {

  if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // ===== SALDO =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'saldo') {
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

    // ===== EMBED (SÓ ADM) =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {

      if (!isAdmin) {
        return interaction.reply({ content: 'Apenas administradores.', ephemeral: true });
      }

      embedSessions[interaction.user.id] = {};

      return interaction.reply({
        embeds: [gerarEmbed({})],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('editar').setLabel('Editar').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
          )
        ],
        ephemeral: true
      });
    }

    // ===== BOTÕES EMBED =====
    if (interaction.isButton()) {

      if (!isAdmin) return interaction.reply({ content: 'Apenas administradores.', ephemeral: true });

      if (interaction.customId === 'editar') {

        const modal = new ModalBuilder()
          .setCustomId('modalEmbed')
          .setTitle('Editar Embed');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('titulo')
              .setLabel('Título')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('desc')
              .setLabel('Descrição')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'enviar') {
        const data = embedSessions[interaction.user.id] || {};
        return interaction.channel.send({ embeds: [gerarEmbed(data)] });
      }
    }

    // ===== MODAL EMBED =====
    if (interaction.isModalSubmit()) {

      const data = {
        title: interaction.fields.getTextInputValue('titulo'),
        description: interaction.fields.getTextInputValue('desc')
      };

      embedSessions[interaction.user.id] = data;

      return interaction.reply({
        embeds: [gerarEmbed(data)],
        ephemeral: true
      });
    }

    // ===== AVALIAR =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'avaliar') {

      if (!isAdmin) {
        return interaction.reply({ content: 'Só administradores.', ephemeral: true });
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
        .setDescription(`**•** Avaliação: ${texto}\n**•** Total: ${db.total}\n**•** Pedido: ${db.pedidos}`);

      const canal = client.channels.cache.get(CANAL_AVALIACOES);
      if (canal) canal.send({ embeds: [embed] });

      return interaction.editReply('Avaliação enviada.');
    }

    // ===== GASTAR =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'gastar') {

      if (!isAdmin) return interaction.reply({ content: 'Apenas admins.', ephemeral: true });

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
    if (interaction.isChatInputCommand() && interaction.commandName === 'removergasto') {

      if (!isAdmin) return interaction.reply({ content: 'Apenas admins.', ephemeral: true });

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
    if (interaction.isChatInputCommand() && interaction.commandName === 'rank') {

      await interaction.deferReply();

      const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);

      const porPagina = 10;
      let pagina = 0;

      async function gerarEmbedRank(p) {

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
        embeds: [await gerarEmbedRank(pagina)],
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
          embeds: [await gerarEmbedRank(pagina)],
          components: [row]
        });
      });
    }

  } catch (err) {
    console.error(err);
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);
