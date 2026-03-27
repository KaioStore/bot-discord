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

// ===== SISTEMA EMBED =====
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

// ===== EMBED =====
function gerarEmbed(data) {
  return new EmbedBuilder()
    .setTitle(data.title || null)
    .setDescription(data.description || null)
    .setColor(data.color || '#2b2d31')
    .setThumbnail(data.thumbnail || null)
    .setImage(data.image || null)
    .setFooter(data.footer ? { text: data.footer } : null)
    .setAuthor(data.author ? { name: data.author } : null);
}

function gerarComponentes(data) {
  if (!data.buttons) return [];

  const row = new ActionRowBuilder();

  data.buttons.forEach(btn => {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(btn.label)
        .setStyle(ButtonStyle.Link)
        .setURL(btn.url)
    );
  });

  return [row];
}

// ===== PAINEL =====
function painel() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_embed').setLabel('+ Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_title').setLabel('Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_desc').setLabel('Descrição').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_color').setLabel('Cor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('edit_image').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_footer').setLabel('Rodapé').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_author').setLabel('Autor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_button').setLabel('+ Botão').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('send_embed').setLabel('Enviar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_message').setLabel('Editar Msg').setStyle(ButtonStyle.Secondary)
    )
  ];
}

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {

  try {

    // 🔥 GARANTE RESPOSTA
    if (interaction.isChatInputCommand()) {
      await interaction.deferReply({ ephemeral: true });
    }

    // ===== SLASH =====
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'saldo') {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const total = gastos[user.id] || 0;

        let vip = "Sem cargo";
        if (total >= 1000) vip = "Diamante";
        else if (total >= 500) vip = "Ouro";
        else if (total >= 300) vip = "Prata";
        else if (total >= 100) vip = "Bronze";

        return interaction.editReply({
          content: `💰 ${user.username} gastou: R$${total}\n🏆 VIP: ${vip}`
        });
      }

      if (interaction.commandName === 'embed') {
        embedSessions[interaction.user.id] = {
          atual: 0,
          lista: [{}]
        };

        return interaction.editReply({
          embeds: [gerarEmbed({})],
          components: painel()
        });
      }

      if (interaction.commandName === 'avaliar') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.editReply({ content: 'Só administradores podem usar.' });
        }

        const texto = interaction.options.getString('texto');

        db.total++;
        db.pedidos++;
        salvar();

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('**Avaliação Recebida! 🖤**')
          .setDescription(`**•** Avaliação: ${texto}\n**•** Total: ${db.total}\n**•** Pedido: ${db.pedidos}`);

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }

      if (interaction.commandName === 'gastar') {
        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        if (!gastos[user.id]) gastos[user.id] = 0;
        gastos[user.id] += valor;

        salvarGastos();

        return interaction.editReply({ content: `Gasto adicionado para ${user.username}` });
      }

      if (interaction.commandName === 'removergasto') {
        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        if (!gastos[user.id]) gastos[user.id] = 0;
        gastos[user.id] -= valor;

        if (gastos[user.id] <= 0) delete gastos[user.id];

        salvarGastos();

        return interaction.editReply({ content: `Gasto removido` });
      }
    }

    // ===== BOTÕES =====
    if (interaction.isButton()) {

      const session = embedSessions[interaction.user.id];
      if (!session) return interaction.reply({ content: 'Sessão expirada.', ephemeral: true });

      const atual = session.lista[session.atual];

      const modal = (id, label) => new ModalBuilder()
        .setCustomId(id)
        .setTitle(label)
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel(label)
              .setStyle(TextInputStyle.Short)
          )
        );

      if (interaction.customId === 'add_embed') session.lista.push({});

      if (interaction.customId === 'edit_title') return interaction.showModal(modal('title', 'Título'));
      if (interaction.customId === 'edit_desc') return interaction.showModal(modal('desc', 'Descrição'));
      if (interaction.customId === 'edit_color') return interaction.showModal(modal('color', 'Cor HEX'));
      if (interaction.customId === 'edit_image') return interaction.showModal(modal('image', 'URL Imagem'));
      if (interaction.customId === 'edit_thumb') return interaction.showModal(modal('thumb', 'Thumbnail'));
      if (interaction.customId === 'edit_footer') return interaction.showModal(modal('footer', 'Rodapé'));
      if (interaction.customId === 'edit_author') return interaction.showModal(modal('author', 'Autor'));

      if (interaction.customId === 'add_button') {
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId('btn_modal')
            .setTitle('Criar Botão')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('label').setLabel('Texto').setStyle(TextInputStyle.Short)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('url').setLabel('Link').setStyle(TextInputStyle.Short)
              )
            )
        );
      }

      if (interaction.customId === 'send_embed') {
        const msg = await interaction.channel.send({
          embeds: session.lista.map(e => gerarEmbed(e)),
          components: gerarComponentes(atual)
        });

        embedMessages[interaction.user.id] = msg;
      }

      if (interaction.customId === 'edit_message') {
        const msg = embedMessages[interaction.user.id];
        if (msg) {
          await msg.edit({
            embeds: session.lista.map(e => gerarEmbed(e)),
            components: gerarComponentes(atual)
          });
        }
      }

      return interaction.update({
        embeds: [gerarEmbed(atual)],
        components: painel()
      });
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

      const session = embedSessions[interaction.user.id];
      if (!session) return interaction.reply({ content: 'Sessão expirada.', ephemeral: true });

      const atual = session.lista[session.atual];

      if (interaction.customId === 'btn_modal') {
        const label = interaction.fields.getTextInputValue('label');
        const url = interaction.fields.getTextInputValue('url');

        if (!atual.buttons) atual.buttons = [];
        atual.buttons.push({ label, url });

        return interaction.update({
          embeds: [gerarEmbed(atual)],
          components: [...painel(), ...gerarComponentes(atual)]
        });
      }

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
        embeds: [gerarEmbed(atual)],
        components: painel()
      });
    }

  } catch (err) {
    console.error(err);

    if (interaction.deferred) {
      interaction.editReply({ content: 'Erro ao executar.' }).catch(() => {});
    } else {
      interaction.reply({ content: 'Erro ao executar.', ephemeral: true }).catch(() => {});
    }
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);
