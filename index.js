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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
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

// ===== EMBED TEMP =====
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

  try {

    // ===== BOTÕES =====
    if (interaction.isButton()) {

      if (!embedsTemp[interaction.user.id]) return;

      // TÍTULO
      if (interaction.customId === 'titulo') {
        const modal = new ModalBuilder()
          .setCustomId('modalTitulo')
          .setTitle('Editar Título');

        const input = new TextInputBuilder()
          .setCustomId('inputTitulo')
          .setLabel('Digite o título')
          .setStyle(TextInputStyle.Short);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      }

      // DESCRIÇÃO
      if (interaction.customId === 'descricao') {
        const modal = new ModalBuilder()
          .setCustomId('modalDesc')
          .setTitle('Editar Descrição');

        const input = new TextInputBuilder()
          .setCustomId('inputDesc')
          .setLabel('Digite a descrição')
          .setStyle(TextInputStyle.Paragraph);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      }

      // COR
      if (interaction.customId === 'cor') {
        const modal = new ModalBuilder()
          .setCustomId('modalCor')
          .setTitle('Editar Cor');

        const input = new TextInputBuilder()
          .setCustomId('inputCor')
          .setLabel('Ex: #ff0000')
          .setStyle(TextInputStyle.Short);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      }

      // RESET
      if (interaction.customId === 'resetar') {

        embedsTemp[interaction.user.id] = {
          title: 'Título',
          description: 'Descrição',
          color: '#2b2d31'
        };

        const embed = new EmbedBuilder()
          .setTitle('Título')
          .setDescription('Descrição')
          .setColor('#2b2d31');

        return interaction.update({ embeds: [embed] });
      }

      // ENVIAR
      if (interaction.customId === 'enviar') {

        const data = embedsTemp[interaction.user.id];

        const embed = new EmbedBuilder()
          .setTitle(data.title)
          .setDescription(data.description)
          .setColor(data.color);

        await interaction.channel.send({ embeds: [embed] });

        return interaction.reply({ content: 'Embed enviado.', ephemeral: true });
      }
    }

    // ===== MODAIS =====
    if (interaction.isModalSubmit()) {

      if (!embedsTemp[interaction.user.id]) return;

      const data = embedsTemp[interaction.user.id];

      if (interaction.customId === 'modalTitulo') {
        data.title = interaction.fields.getTextInputValue('inputTitulo');
      }

      if (interaction.customId === 'modalDesc') {
        data.description = interaction.fields.getTextInputValue('inputDesc');
      }

      if (interaction.customId === 'modalCor') {
        data.color = interaction.fields.getTextInputValue('inputCor');
      }

      const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setDescription(data.description)
        .setColor(data.color);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (!interaction.isChatInputCommand()) return;

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

    // ===== EMBED =====
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

      const row = {
        type: 1,
        components: [
          { type: 2, style: 1, label: 'Título', custom_id: 'titulo' },
          { type: 2, style: 1, label: 'Descrição', custom_id: 'descricao' },
          { type: 2, style: 2, label: 'Cor', custom_id: 'cor' },
          { type: 2, style: 4, label: 'Resetar', custom_id: 'resetar' },
          { type: 2, style: 3, label: 'Enviar', custom_id: 'enviar' }
        ]
      };

      return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
    }

    // ===== AVALIAR =====
    if (interaction.commandName === 'avaliar') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Só administradores podem usar.', ephemeral: true });
      }

      const texto = interaction.options.getString('texto');

      await interaction.deferReply({ ephemeral: true });

      db.total++;
      db.pedidos++;
      salvar();

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('Avaliação Recebida')
        .setDescription(`Avaliação: ${texto}\nTotal: ${db.total}`);

      const canal = client.channels.cache.get(CANAL_AVALIACOES);
      if (canal) canal.send({ embeds: [embed] });

      return interaction.editReply('Enviado.');
    }

  } catch (err) {
    console.error(err);
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);
