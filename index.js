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

const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== BANCO =====
let db = { total: 419, pedidos: 450 };
let gastos = {};

const embedSessions = {};

// ===== EMBED =====
function gerarEmbedCustom(data) {
  return new EmbedBuilder()
    .setTitle(data.title || null)
    .setDescription(data.description || "Abra um painel interativo de criação de embeds")
    .setColor('#2b2d31')
    .setImage(data.image || null)
    .setThumbnail(data.thumb || null)
    .setAuthor(
      data.author
        ? { name: data.author, iconURL: data.authorIcon || null }
        : null
    );
}

// ===== BOT ONLINE =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {
  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // ===== SALDO =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'saldo') {
      const user = interaction.options.getUser('usuario') || interaction.user;
      const total = gastos[user.id] || 0;

      return interaction.reply({
        content: `💰 ${user.username} gastou: R$${total}`,
        ephemeral: true
      });
    }

    // ===== EMBED =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {

      if (!isAdmin) return interaction.reply({ content: 'Apenas admins.', ephemeral: true });

      embedSessions[interaction.user.id] = {
        lista: [{}],
        atual: 0
      };

      return atualizarPainel(interaction);
    }

    // ===== SELECT =====
    if (interaction.isStringSelectMenu()) {

      const session = embedSessions[interaction.user.id];
      if (!session) return;

      session.atual = parseInt(interaction.values[0]);

      return atualizarPainel(interaction);
    }

    // ===== BOTÕES =====
    if (interaction.isButton()) {

      const session = embedSessions[interaction.user.id];
      if (!session) return;

      const atual = session.lista[session.atual];

      // ADD EMBED
      if (interaction.customId === 'add_embed') {
        session.lista.push({});
        session.atual = session.lista.length - 1;

        return atualizarPainel(interaction);
      }

      // ABRIR MODAL PADRÃO
      function abrirModal(id, label, value, style = TextInputStyle.Short) {
        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle('Editar')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('input')
                .setLabel(label)
                .setStyle(style)
                .setValue(value || "")
            )
          );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'titulo')
        return abrirModal('titulo', 'Título', atual.title);

      if (interaction.customId === 'desc')
        return abrirModal('desc', 'Descrição', atual.description, TextInputStyle.Paragraph);

      if (interaction.customId === 'imagem')
        return abrirModal('imagem', 'URL da imagem', atual.image);

      if (interaction.customId === 'thumb')
        return abrirModal('thumb', 'Thumbnail', atual.thumb);

      if (interaction.customId === 'autor') {
        const modal = new ModalBuilder()
          .setCustomId('autor_modal')
          .setTitle('Autor')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('nome')
                .setLabel('Nome')
                .setStyle(TextInputStyle.Short)
                .setValue(atual.author || "")
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('icon')
                .setLabel('Avatar URL')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(atual.authorIcon || "")
            )
          );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'enviar') {
        await interaction.channel.send({
          embeds: session.lista.map(e => gerarEmbedCustom(e))
        });

        return interaction.reply({ content: 'Enviado!', ephemeral: true });
      }
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

      const session = embedSessions[interaction.user.id];
      if (!session) return;

      const atual = session.lista[session.atual];

      if (interaction.customId === 'autor_modal') {
        atual.author = interaction.fields.getTextInputValue('nome');
        atual.authorIcon = interaction.fields.getTextInputValue('icon');
      } else {
        const valor = interaction.fields.getTextInputValue('input');

        if (interaction.customId === 'titulo') atual.title = valor;
        if (interaction.customId === 'desc') atual.description = valor;
        if (interaction.customId === 'imagem') atual.image = valor;
        if (interaction.customId === 'thumb') atual.thumb = valor;
      }

      return atualizarPainel(interaction);
    }

    // ===== AVALIAR =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'avaliar') {

      if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

      const texto = interaction.options.getString('texto');

      await interaction.deferReply({ ephemeral: true });

      db.total++;
      db.pedidos++;

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

  } catch (err) {
    console.error(err);
  }
});

// ===== PAINEL =====
async function atualizarPainel(interaction) {

  const session = embedSessions[interaction.user.id];
  const atual = session.lista[session.atual];

  const select = new StringSelectMenuBuilder()
    .setCustomId('select_embed')
    .setPlaceholder('Selecionar embed')
    .addOptions(
      session.lista.map((_, i) => ({
        label: `Embed ${i + 1}`,
        value: `${i}`
      }))
    );

  const components = [
    new ActionRowBuilder().addComponents(select),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('imagem').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('autor').setLabel('Autor').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
    )
  ];

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({
      embeds: [gerarEmbedCustom(atual)],
      components
    });
  } else {
    return interaction.reply({
      embeds: [gerarEmbedCustom(atual)],
      components,
      ephemeral: true
    });
  }
}

client.login(TOKEN);
setInterval(() => {}, 1000);
