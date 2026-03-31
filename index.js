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
client.on('ready', async () => {
  console.log(`Logado como ${client.user.tag}`);

  await client.application.commands.set([
    {
      name: 'embed',
      description: 'Criar embed'
    },
    {
      name: 'avaliar',
      description: 'Enviar avaliação',
      options: [
        {
          name: 'texto',
          type: 3,
          description: 'Texto da avaliação',
          required: true
        }
      ]
    }
  ]);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

    // ===== COMANDOS =====
    if (interaction.isChatInputCommand()) {

      // 🔥 EMBED (SEM DEFER - RESPOSTA RÁPIDA)
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

      // 🔥 AVALIAR (COM DEFER)
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

    // ===== RESTO DO SISTEMA =====
    const session = embedSessions[interaction.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual];

    // SELECT
    if (interaction.isStringSelectMenu()) {
      session.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    // BOTÕES
    if (interaction.isButton()) {
      const id = interaction.customId;

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
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cor').setLabel('Cor: azul, verde, cinza, preto').setStyle(TextInputStyle.Short).setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }

      if (id === 'enviar') {
        await interaction.deferReply({ ephemeral: true });

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

        return interaction.editReply({ content: 'Enviado!' });
      }
    }

  } catch (err) {
    console.error(err);
  }
});

// ===== FUNÇÕES =====
function montarEmbed(data) {
  const embed = new EmbedBuilder().setColor('#2b2d31');

  if (data.title) embed.setTitle(data.title);
  embed.setDescription(data.description || '‎');

  if (data.image) embed.setImage(data.image);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  if (data.author) {
    embed.setAuthor({
      name: data.author.nome || '‎',
      iconURL: data.author.icon || undefined
    });
  }

  return embed;
}

function gerarMenu(userId) {
  const session = embedSessions[userId];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .setPlaceholder('Selecionar embed')
        .addOptions(
          session.embeds.map((e,i)=>({
            label:`Embed ${i+1}`,
            value:`${i}`
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('delete').setLabel('Excluir').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('add_button').setLabel('Adicionar botão').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('gerenciar_botoes').setLabel('Gerenciar botões').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
    )
  ];
}

function gerarEditor() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('imagem').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumb').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('autor').setLabel('Autor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(ButtonStyle.Primary)
    )
  ];
}

// ===== WEB =====
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot online'));
app.listen(PORT);

// ===== LOGIN =====
client.login(TOKEN);
