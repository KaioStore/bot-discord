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

// ===== SISTEMA EMBED =====
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

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {

  try {

    // ===== BOTÕES =====
    if (interaction.isButton()) {

      if (!embedsTemp[interaction.user.id]) return;

      const criarModal = (id, label, style = TextInputStyle.Short) => {
        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle(label);

        const input = new TextInputBuilder()
          .setCustomId('input')
          .setLabel(label)
          .setStyle(style);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return modal;
      };

      if (interaction.customId === 'titulo')
        return interaction.showModal(criarModal('tituloModal', 'Título'));

      if (interaction.customId === 'descricao')
        return interaction.showModal(criarModal('descModal', 'Descrição', TextInputStyle.Paragraph));

      if (interaction.customId === 'cor')
        return interaction.showModal(criarModal('corModal', 'Cor HEX (#000000)'));

      if (interaction.customId === 'thumbnail')
        return interaction.showModal(criarModal('thumbModal', 'URL da Thumbnail'));

      if (interaction.customId === 'imagem')
        return interaction.showModal(criarModal('imgModal', 'URL da Imagem'));

      if (interaction.customId === 'rodape')
        return interaction.showModal(criarModal('rodapeModal', 'Rodapé'));

      if (interaction.customId === 'autor')
        return interaction.showModal(criarModal('autorModal', 'Autor'));

      if (interaction.customId === 'resetar') {
        embedsTemp[interaction.user.id] = {};
      }

      if (interaction.customId === 'enviar') {
        const data = embedsTemp[interaction.user.id];

        const embed = new EmbedBuilder()
          .setTitle(data.title || null)
          .setDescription(data.description || null)
          .setColor(data.color || '#2b2d31')
          .setThumbnail(data.thumbnail || null)
          .setImage(data.image || null)
          .setFooter(data.footer ? { text: data.footer } : null)
          .setAuthor(data.author ? { name: data.author } : null);

        await interaction.channel.send({ embeds: [embed] });

        return interaction.reply({ content: 'Embed enviado.', ephemeral: true });
      }

      const data = embedsTemp[interaction.user.id];

      const embed = new EmbedBuilder()
        .setTitle(data.title || 'Título')
        .setDescription(data.description || 'Descrição')
        .setColor(data.color || '#2b2d31')
        .setThumbnail(data.thumbnail || null)
        .setImage(data.image || null)
        .setFooter(data.footer ? { text: data.footer } : null)
        .setAuthor(data.author ? { name: data.author } : null);

      return interaction.update({ embeds: [embed] });
    }

    // ===== MODAIS =====
    if (interaction.isModalSubmit()) {

      if (!embedsTemp[interaction.user.id]) embedsTemp[interaction.user.id] = {};

      const value = interaction.fields.getTextInputValue('input');

      const map = {
        tituloModal: 'title',
        descModal: 'description',
        corModal: 'color',
        thumbModal: 'thumbnail',
        imgModal: 'image',
        rodapeModal: 'footer',
        autorModal: 'author'
      };

      embedsTemp[interaction.user.id][map[interaction.customId]] = value;

      const data = embedsTemp[interaction.user.id];

      const embed = new EmbedBuilder()
        .setTitle(data.title || 'Título')
        .setDescription(data.description || 'Descrição')
        .setColor(data.color || '#2b2d31')
        .setThumbnail(data.thumbnail || null)
        .setImage(data.image || null)
        .setFooter(data.footer ? { text: data.footer } : null)
        .setAuthor(data.author ? { name: data.author } : null);

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

      embedsTemp[interaction.user.id] = {};

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
          { type: 2, style: 2, label: 'Thumbnail', custom_id: 'thumbnail' },
          { type: 2, style: 2, label: 'Imagem', custom_id: 'imagem' }
        ]
      };

      const row2 = {
        type: 1,
        components: [
          { type: 2, style: 2, label: 'Autor', custom_id: 'autor' },
          { type: 2, style: 2, label: 'Rodapé', custom_id: 'rodape' },
          { type: 2, style: 4, label: 'Resetar', custom_id: 'resetar' },
          { type: 2, style: 3, label: 'Enviar', custom_id: 'enviar' }
        ]
      };

      return interaction.reply({
        embeds: [embed],
        components: [row, row2],
        ephemeral: true
      });
    }

  } catch (err) {
    console.error(err);
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);
