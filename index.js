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
  TextInputStyle,
  StringSelectMenuBuilder
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
const embedSessions = {};
const embedMessages = {};

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
    return setTimeout(() => res.redirect(`/perfil/${id}`), 2000);
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

// ===== RANKING =====
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

// ===== GERAR EMBED =====
function gerarEmbed(data) {
  return new EmbedBuilder()
    .setTitle(data.title || 'Título')
    .setDescription(data.description || 'Descrição')
    .setColor(data.color || '#2b2d31')
    .setThumbnail(data.thumbnail || null)
    .setImage(data.image || null)
    .setFooter(data.footer ? { text: data.footer } : null)
    .setAuthor(data.author ? { name: data.author } : null);
}

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {

  // ===== SLASH =====
  if (interaction.isChatInputCommand()) {

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

    // ===== EMBED COMPLETO =====
    if (interaction.commandName === 'embed') {

      embedSessions[interaction.user.id] = {
        atual: 0,
        lista: [{}]
      };

      const select = new StringSelectMenuBuilder()
        .setCustomId('select_embed')
        .setPlaceholder('Selecionar embed')
        .addOptions([{ label: 'Embed 1', value: '0' }]);

      const row1 = new ActionRowBuilder().addComponents(select);

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('add_embed').setLabel('+ Embed').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('edit_title').setLabel('Título').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('edit_desc').setLabel('Descrição').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('edit_color').setLabel('Cor').setStyle(ButtonStyle.Secondary)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('edit_image').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('edit_thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('edit_footer').setLabel('Rodapé').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('edit_author').setLabel('Autor').setStyle(ButtonStyle.Secondary)
      );

      const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('send_embed').setLabel('Enviar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('edit_message').setLabel('Editar Msg').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('reset_embed').setLabel('Resetar').setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        embeds: [gerarEmbed(embedSessions[interaction.user.id].lista[0])],
        components: [row1, row2, row3, row4],
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
        .setTitle('**Avaliação Recebida! 🖤**')
        .setDescription(`**•** ${texto}`);

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

      return interaction.reply({ content: `Gasto adicionado para ${user.username}`, ephemeral: true });
    }

    // ===== REMOVER =====
    if (interaction.commandName === 'removergasto') {
      const user = interaction.options.getUser('usuario');
      const valor = interaction.options.getNumber('valor');

      if (!gastos[user.id]) gastos[user.id] = 0;
      gastos[user.id] -= valor;

      if (gastos[user.id] <= 0) delete gastos[user.id];

      salvarGastos();

      return interaction.reply({ content: `Gasto removido`, ephemeral: true });
    }
  }

  // ===== SELECT =====
  if (interaction.isStringSelectMenu()) {
    const session = embedSessions[interaction.user.id];
    if (!session) return;

    session.atual = parseInt(interaction.values[0]);

    return interaction.update({
      embeds: [gerarEmbed(session.lista[session.atual])]
    });
  }

  // ===== BOTÕES =====
  if (interaction.isButton()) {

    const session = embedSessions[interaction.user.id];
    if (!session) return;

    const atual = session.lista[session.atual];

    const criarModal = (id, label) => {
      const modal = new ModalBuilder().setCustomId(id).setTitle(label);

      const input = new TextInputBuilder()
        .setCustomId('input')
        .setLabel(label)
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return modal;
    };

    if (interaction.customId === 'add_embed') {
      session.lista.push({});
    }

    if (interaction.customId === 'edit_title') return interaction.showModal(criarModal('title', 'Título'));
    if (interaction.customId === 'edit_desc') return interaction.showModal(criarModal('desc', 'Descrição'));
    if (interaction.customId === 'edit_color') return interaction.showModal(criarModal('color', 'Cor HEX'));
    if (interaction.customId === 'edit_image') return interaction.showModal(criarModal('image', 'URL Imagem'));
    if (interaction.customId === 'edit_thumb') return interaction.showModal(criarModal('thumb', 'Thumbnail'));
    if (interaction.customId === 'edit_footer') return interaction.showModal(criarModal('footer', 'Rodapé'));
    if (interaction.customId === 'edit_author') return interaction.showModal(criarModal('author', 'Autor'));

    if (interaction.customId === 'send_embed') {
      const msg = await interaction.channel.send({
        embeds: session.lista.map(e => gerarEmbed(e))
      });
      embedMessages[interaction.user.id] = msg;
    }

    if (interaction.customId === 'edit_message') {
      const msg = embedMessages[interaction.user.id];
      if (msg) {
        await msg.edit({
          embeds: session.lista.map(e => gerarEmbed(e))
        });
      }
    }

    if (interaction.customId === 'reset_embed') {
      session.lista = [{}];
      session.atual = 0;
    }

    return interaction.update({
      embeds: [gerarEmbed(atual)]
    });
  }

  // ===== MODAL =====
  if (interaction.isModalSubmit()) {

    const session = embedSessions[interaction.user.id];
    if (!session) return;

    const atual = session.lista[session.atual];
    const value = interaction.fields.getTextInputValue('input');

    const map = {
      title: 'title',
      desc: 'description',
      color: 'color',
      image: 'image',
      thumb: 'thumbnail',
      footer: 'footer',
      author: 'author'
    };

    atual[map[interaction.customId]] = value;

    return interaction.update({
      embeds: [gerarEmbed(atual)]
    });
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);
