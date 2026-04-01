// 🔥 NÃO TRATADOS
process.on('uncaughtException', (err) => console.error(err));
process.on('unhandledRejection', (err) => console.error(err));

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes
} = require('discord.js');

const fs = require('fs');
const express = require('express');
const app = express();

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1485623307364466861';
const GUILD_ID = '1411478770824511652';
const CANAL_AVALIACOES = '1411493010268753930';

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// ===== BANCO =====
let db = { total: 427, pedidos: 458 };
if (fs.existsSync('./db.json')) {
  db = JSON.parse(fs.readFileSync('./db.json'));
}
const salvar = () => fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));

// ===== SESSÕES =====
const embedSessions = {};
const savedEmbeds = {};

// ===== READY =====
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [
      {
        name: 'embed',
        description: 'Painel de embed'
      },
      {
        name: 'avaliar',
        description: 'Enviar avaliação',
        options: [
          {
            name: 'texto',
            type: 3,
            required: true,
            description: 'Texto'
          }
        ]
      }
    ]
  });
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (i) => {
  try {

    // BOTÕES DE TEXTO
    if (i.isButton() && i.customId.startsWith('msg_')) {
      return i.reply({ content: i.customId.slice(4), ephemeral: true });
    }

    // ===== COMANDOS =====
    if (i.isChatInputCommand()) {

      if (i.commandName === 'embed') {
        embedSessions[i.user.id] = {
          embeds: [{}],
          atual: 0,
          buttons: []
        };

        return i.reply({
          content: 'Painel aberto',
          components: menu(i.user.id),
          ephemeral: true
        });
      }

      if (i.commandName === 'avaliar') {
        const texto = i.options.getString('texto');

        db.total++;
        db.pedidos++;
        salvar();

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('**Avaliação Recebida! 🖤**')
          .setDescription(`**• Avaliação:** ${texto}
**• Total de avaliações:** ${db.total}
**• Pedido:** ${db.pedidos}`);

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return i.reply({ content: 'Enviado!', ephemeral: true });
      }
    }

    const session = embedSessions[i.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual];

    // ===== BOTÕES =====
    if (i.isButton()) {

      if (i.customId === 'add_embed') {
        session.embeds.push({});
        session.atual = session.embeds.length - 1;
      }

      if (i.customId === 'delete_embed') {
        session.embeds.splice(session.atual, 1);
        session.atual = 0;
      }

      if (i.customId === 'titulo') {
        return modal(i, 'titulo', 'Título');
      }

      if (i.customId === 'desc') {
        return modal(i, 'desc', 'Descrição');
      }

      if (i.customId === 'imagem') {
        return modal(i, 'imagem', 'URL da imagem');
      }

      if (i.customId === 'thumb') {
        return modal(i, 'thumb', 'URL da thumb');
      }

      if (i.customId === 'autor') {
        return modal(i, 'autor', 'Nome do autor');
      }

      if (i.customId === 'add_button') {
        return modal(i, 'btn', 'Criar botão');
      }

      if (i.customId === 'enviar') {

        const rows = [];
        let row = new ActionRowBuilder();

        session.buttons.forEach((b, index) => {
          const styleMap = {
            azul: ButtonStyle.Primary,
            verde: ButtonStyle.Success,
            cinza: ButtonStyle.Secondary,
            preto: ButtonStyle.Secondary
          };

          row.addComponents(
            new ButtonBuilder()
              .setLabel(b.label)
              .setStyle(styleMap[b.cor] || ButtonStyle.Primary)
              .setCustomId(`msg_${b.valor}`)
          );

          if ((index + 1) % 5 === 0) {
            rows.push(row);
            row = new ActionRowBuilder();
          }
        });

        if (row.components.length) rows.push(row);

        const msg = await i.channel.send({
          embeds: session.embeds.map(e => build(e)),
          components: rows
        });

        savedEmbeds[msg.id] = { embeds: session.embeds, buttons: session.buttons };

        return i.reply({ content: 'Enviado!', ephemeral: true });
      }

      return i.update({
        content: 'Editando...',
        components: menu(i.user.id)
      });
    }

    // ===== MODAL =====
    if (i.isModalSubmit()) {

      const val = i.fields.getTextInputValue('input');

      if (i.customId === 'btn') {
        const [label, valor, cor] = val.split('|');
        session.buttons.push({ label, valor, cor });
      } else {
        atual[i.customId] = val;
      }

      return i.reply({ content: 'Salvo!', ephemeral: true });
    }

  } catch (err) {
    console.error(err);
  }
});

// ===== FUNÇÕES =====
function build(e) {
  const embed = new EmbedBuilder().setColor('#2b2d31');

  if (e.titulo) embed.setTitle(e.titulo);
  if (e.desc) embed.setDescription(e.desc);
  if (e.imagem) embed.setImage(e.imagem);
  if (e.thumb) embed.setThumbnail(e.thumb);
  if (e.autor) embed.setAuthor({ name: e.autor });

  return embed;
}

function menu(id) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_embed').setLabel('Add Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('delete_embed').setLabel('Excluir').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('add_button').setLabel('Botão').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('desc').setLabel('Desc').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('imagem').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumb').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('autor').setLabel('Autor').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function modal(i, id, label) {
  const m = new ModalBuilder()
    .setCustomId(id)
    .setTitle(label);

  m.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('input')
        .setLabel(label)
        .setStyle(TextInputStyle.Short)
    )
  );

  return i.showModal(m);
}

// ===== WEB =====
app.get('/', (req, res) => res.send('online'));
app.listen(3000);

// ===== LOGIN =====
client.login(TOKEN);
