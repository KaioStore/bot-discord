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
const cors = require('cors');

const app = express();
app.use(cors());

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1485623307364466861';
const GUILD_ID = '1411478770824511652';
const CANAL_AVALIACOES = '1411493010268753930';

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
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
    db = { total: 427, pedidos: 458, embeds: {} };
  }
} catch {
  db = { total: 427, pedidos: 458, embeds: {} };
}

function salvar() {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

// ===== SESSÕES =====
const embedSessions = {};

// ===== READY =====
client.once('ready', async () => {
  console.log(`✅ Logado como ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [
      {
        name: 'avaliar',
        description: 'Enviar avaliação',
        options: [
          {
            name: 'texto',
            type: 3,
            description: 'Escreva a avaliação',
            required: true
          }
        ]
      },
      {
        name: 'embed',
        description: 'Abrir painel embed'
      }
    ]
  });
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    // 🔥 BOTÕES DE MENSAGEM
    if (interaction.isButton() && interaction.customId.startsWith('msg_')) {
      return interaction.reply({
        content: interaction.customId.slice(4),
        ephemeral: true
      });
    }

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // ===== SLASH =====
    if (interaction.isChatInputCommand()) {

      // EMBED
      if (interaction.commandName === 'embed') {
        embedSessions[interaction.user.id] = {
          embeds: [{
            title: 'Novo Embed',
            description: 'Lembre-se que seu Embed não pode ser vazio!'
          }],
          atual: 0,
          buttons: [],
          editandoBtn: null
        };

        return interaction.reply({
          embeds: [montarEmbed(embedSessions[interaction.user.id].embeds[0])],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

      // AVALIAÇÃO (COMPLETA ORIGINAL)
      if (interaction.commandName === 'avaliar') {
        if (!isAdmin) {
          return interaction.reply({ content: 'Só administradores.', ephemeral: true });
        }

        const texto = interaction.options.getString('texto');

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

        return interaction.reply({ content: 'Avaliação enviada.', ephemeral: true });
      }
    }

    const session = embedSessions[interaction.user.id];
    if (!session) return;

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

      if (id === 'add_embed') {
        session.embeds.push({
          title: 'Novo Embed',
          description: 'Novo conteúdo'
        });

        session.atual = session.embeds.length - 1;

        return interaction.update({
          embeds: [montarEmbed(session.embeds[session.atual])],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (id === 'delete_embed') {
        session.embeds.splice(session.atual, 1);

        if (session.embeds.length === 0) {
          session.embeds.push({ title: 'Novo Embed', description: '...' });
        }

        session.atual = 0;

        return interaction.update({
          embeds: [montarEmbed(session.embeds[0])],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (id === 'add_button') {
        const modal = new ModalBuilder()
          .setCustomId('criar_botao')
          .setTitle('Adicionar botão');

        modal.addComponents(
          rowInput('label', 'Nome'),
          rowInput('valor', 'Mensagem ou link'),
          rowInput('cor', 'Cor: azul, verde, cinza, preto')
        );

        return interaction.showModal(modal);
      }

      if (id === 'gerenciar_botoes') {
        if (session.buttons.length === 0) {
          return interaction.reply({ content: 'Nenhum botão.', ephemeral: true });
        }

        const rows = session.buttons.map((b, i) =>
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`edit_btn_${i}`).setLabel(`Editar ${b.label}`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`del_btn_${i}`).setLabel('Excluir').setStyle(ButtonStyle.Danger)
          )
        );

        return interaction.reply({ content: 'Gerenciar:', components: rows, ephemeral: true });
      }

      if (id.startsWith('del_btn_')) {
        const i = Number(id.split('_')[2]);
        session.buttons.splice(i, 1);
        return interaction.reply({ content: 'Removido!', ephemeral: true });
      }

      if (id === 'enviar') {
        const rows = montarBotoes(session.buttons);

        const msg = await interaction.channel.send({
          embeds: session.embeds.map(e => montarEmbed(e)),
          components: rows
        });

        db.embeds[msg.id] = session;
        salvar();

        return interaction.reply({ content: 'Enviado e salvo!', ephemeral: true });
      }
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

      if (interaction.customId === 'criar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');
        const cor = interaction.fields.getTextInputValue('cor');

        session.buttons.push({ label, valor, cor });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
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

  return embed;
}

function montarBotoes(btns) {
  const rows = [];
  let row = new ActionRowBuilder();

  btns.forEach((b, i) => {
    let style = ButtonStyle.Primary;
    if (b.cor === 'verde') style = ButtonStyle.Success;
    if (b.cor === 'cinza' || b.cor === 'preto') style = ButtonStyle.Secondary;

    row.addComponents(
      new ButtonBuilder()
        .setLabel(b.label)
        .setCustomId(`msg_${b.valor}`)
        .setStyle(style)
    );

    if ((i + 1) % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  });

  if (row.components.length) rows.push(row);

  return rows;
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
      new ButtonBuilder().setCustomId('delete_embed').setLabel('Excluir Embed').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('add_button').setLabel('Adicionar botão').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('gerenciar_botoes').setLabel('Gerenciar botões').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
    )
  ];
}

function rowInput(id, label) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short)
  );
}

// ===== WEB =====
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot online'));
app.listen(PORT);

// ===== LOGIN =====
client.login(TOKEN);
