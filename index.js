// 🔥 NÃO TRATADOS
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
  StringSelectMenuBuilder,
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

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== BANCO =====
let db;

try {
  if (fs.existsSync('./db.json')) {
    db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
  } else {
    db = { total: 427, pedidos: 458 };
  }
} catch {
  db = { total: 427, pedidos: 458 };
}

function salvar() {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

// ===== EMBED SYSTEM =====
const embedSessions = {};

// ===== READY =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // ===== COMANDOS =====
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'embed') {

        if (!embedSessions[interaction.user.id]) {
          embedSessions[interaction.user.id] = {
            embeds: [{
              title: 'Novo Embed',
              description: 'Lembre-se que seu Embed não pode ser vazio!'
            }],
            atual: 0,
            buttons: []
          };
        }

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#2b2d31')
              .setTitle('Painel de Embed')
              .setDescription('Use os botões abaixo')
          ],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

      if (interaction.commandName === 'avaliar') {
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
          .setDescription(`**• Avaliação:** ${texto}
**• Total de avaliações:** ${db.total}
**• Pedido:** ${db.pedidos}

Esta avaliação foi registrada de forma **anônima**, devido ao sistema de banimento do **FLEE THE FACILITY**, prezamos pelo máximo de segurança possível dos nossos **clientes!**`)
          .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png');

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }
    }

    // ===== SESSION =====
    const session = embedSessions[interaction.user.id];
    if (!session) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        return interaction.reply({ content: 'Sessão perdida.', ephemeral: true });
      }
      return;
    }

    let atual = session.embeds[session.atual];

    // ===== SELECT =====
    if (interaction.isStringSelectMenu()) {
      session.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    // ===== BOTÕES =====
    if (interaction.isButton()) {
      const id = interaction.customId;

      // ===== BOTÃO MENSAGEM =====
      if (id.startsWith('msg_')) {
        const index = Number(id.split('_')[1]);
        const btn = session.buttons[index];

        if (!btn) return interaction.reply({ content: 'Botão inválido.', ephemeral: true });

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription(btn.valor)],
          ephemeral: true
        });
      }

      // ===== GERENCIAR BOTÕES =====
      if (id === 'gerenciar_botoes') {
        if (session.buttons.length === 0) {
          return interaction.reply({ content: 'Você não tem botões.', ephemeral: true });
        }

        const rows = session.buttons.map((btn, i) =>
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel(`Editar: ${btn.label}`)
              .setCustomId(`edit_btn_${i}`)
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel('Remover')
              .setCustomId(`delete_btn_${i}`)
              .setStyle(ButtonStyle.Danger)
          )
        );

        return interaction.update({
          content: 'Gerenciar botões:',
          embeds: [],
          components: rows
        });
      }

      if (id.startsWith('delete_btn_')) {
        const index = Number(id.split('_')[2]);
        session.buttons.splice(index, 1);

        return interaction.update({
          content: 'Botão removido!',
          components: []
        });
      }

      if (id.startsWith('edit_btn_')) {
        const index = Number(id.split('_')[2]);
        const btn = session.buttons[index];

        const modal = new ModalBuilder()
          .setCustomId(`edit_btn_modal_${index}`)
          .setTitle('Editar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('label')
              .setLabel('Nome')
              .setStyle(TextInputStyle.Short)
              .setValue(btn.label)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('valor')
              .setLabel('Mensagem/Link')
              .setStyle(TextInputStyle.Paragraph)
              .setValue(btn.valor)
          )
        );

        return interaction.showModal(modal);
      }

      // ===== EMBEDS =====
      if (id === 'delete') {
        if (session.embeds.length <= 1) {
          return interaction.reply({ content: 'Você precisa ter pelo menos 1 embed.', ephemeral: true });
        }

        session.embeds.splice(session.atual, 1);
        session.atual = 0;

        return interaction.update({
          embeds: [montarEmbed(session.embeds[0])],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (id === 'add_embed') {
        session.embeds.push({
          title: 'Novo Embed',
          description: 'Lembre-se que seu Embed não pode ser vazio!'
        });
        session.atual = session.embeds.length - 1;

        return interaction.update({
          embeds: [montarEmbed(session.embeds[session.atual])],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (id === 'edit') {
        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarEditor()
        });
      }

      if (id === 'voltar') {
        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (id === 'add_button') {
        const modal = new ModalBuilder()
          .setCustomId('criar_botao')
          .setTitle('Adicionar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Nome do botão').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Mensagem ou link').setStyle(TextInputStyle.Paragraph)
          )
        );

        return interaction.showModal(modal);
      }

      if (id === 'enviar') {
        const rows = [];
        let row = new ActionRowBuilder();

        session.buttons.forEach((btn, i) => {
          if (i % 5 === 0 && i !== 0) {
            rows.push(row);
            row = new ActionRowBuilder();
          }

          if (btn.valor.startsWith('http')) {
            row.addComponents(
              new ButtonBuilder().setLabel(btn.label).setStyle(ButtonStyle.Link).setURL(btn.valor)
            );
          } else {
            row.addComponents(
              new ButtonBuilder().setLabel(btn.label).setStyle(btn.style).setCustomId(`msg_${i}`)
            );
          }
        });

        if (row.components.length > 0) rows.push(row);

        await interaction.channel.send({
          embeds: session.embeds.map(e => montarEmbed(e)),
          components: rows
        });

        return interaction.reply({ content: 'Enviado!', ephemeral: true });
      }
    }

    // ===== MODAIS =====
    if (interaction.isModalSubmit()) {

      if (interaction.customId.startsWith('edit_btn_modal_')) {
        const index = Number(interaction.customId.split('_')[3]);

        session.buttons[index].label = interaction.fields.getTextInputValue('label');
        session.buttons[index].valor = interaction.fields.getTextInputValue('valor');

        return interaction.reply({ content: 'Botão editado!', ephemeral: true });
      }

      if (interaction.customId === 'criar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');

        session.buttons.push({ label, valor, style: ButtonStyle.Secondary });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }
    }

  } catch (err) {
    console.error(err);
  }
});
