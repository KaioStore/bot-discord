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
client.once('ready', async () => {
  console.log(`Logado como ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      {
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
      }
    );

    console.log('✅ Comandos atualizados!');
  } catch (err) {
    console.error(err);
  }
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    // 🔥 BOTÃO GLOBAL
    if (interaction.isButton() && interaction.customId.startsWith('msg_')) {
      const texto = interaction.customId.slice(4);

      return interaction.reply({
        content: texto,
        ephemeral: true
      });
    }

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // ===== SLASH =====
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'embed') {

        embedSessions[interaction.user.id] = {
          embeds: [{
            title: 'Novo Embed',
            description: 'Lembre-se que seu Embed não pode ser vazio!'
          }],
          atual: 0,
          buttons: [],
          editando: null
        };

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

    const session = embedSessions[interaction.user.id];

    // 🔥 CORREÇÃO (NÃO BLOQUEIA COMANDO)
    if (!session && (interaction.isButton() || interaction.isStringSelectMenu())) {
      return interaction.reply({
        content: 'Sessão expirada. Use /embed novamente.',
        ephemeral: true
      });
    }

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

      if (id === 'delete') {
        session.embeds.splice(session.atual, 1);

        if (session.embeds.length === 0) {
          session.embeds.push({
            title: 'Novo Embed',
            description: 'Lembre-se que seu Embed não pode ser vazio!'
          });
        }

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

      if (id === 'add_button') {
        const modal = new ModalBuilder()
          .setCustomId('criar_botao')
          .setTitle('Adicionar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Nome').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Mensagem ou link').setStyle(TextInputStyle.Paragraph)
          )
        );

        return interaction.showModal(modal);
      }

      if (id === 'gerenciar_botoes') {
        if (session.buttons.length === 0) {
          return interaction.reply({ content: 'Nenhum botão criado.', ephemeral: true });
        }

        const rows = session.buttons.map((btn, i) =>
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`editar_btn_${i}`)
              .setLabel(`Editar ${btn.label}`)
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`delete_btn_${i}`)
              .setLabel('Excluir')
              .setStyle(ButtonStyle.Danger)
          )
        );

        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: rows
        });
      }

      if (id.startsWith('editar_btn_')) {
        const index = Number(id.split('_')[2]);
        session.editando = index;

        const btn = session.buttons[index];

        const modal = new ModalBuilder()
          .setCustomId('editar_botao')
          .setTitle('Editar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Nome').setStyle(TextInputStyle.Short).setValue(btn.label)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Valor').setStyle(TextInputStyle.Paragraph).setValue(btn.valor)
          )
        );

        return interaction.showModal(modal);
      }

      if (id.startsWith('delete_btn_')) {
        const index = Number(id.split('_')[2]);
        session.buttons.splice(index, 1);

        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarMenu(interaction.user.id)
        });
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
              new ButtonBuilder().setLabel(btn.label).setStyle(ButtonStyle.Primary).setCustomId(`msg_${btn.valor}`)
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

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

      let atual = session.embeds[session.atual];

      if (interaction.customId === 'criar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');

        session.buttons.push({ label, valor });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }

      if (interaction.customId === 'editar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');

        session.buttons[session.editando] = { label, valor };

        return interaction.reply({ content: 'Botão editado!', ephemeral: true });
      }

      const valor = interaction.fields.getTextInputValue('input');

      if (interaction.customId === 'titulo') atual.title = valor;
      if (interaction.customId === 'desc') atual.description = valor;
      if (interaction.customId === 'imagem') atual.image = valor;
      if (interaction.customId === 'thumb') atual.thumbnail = valor;

      return interaction.update({
        embeds: [montarEmbed(atual)],
        components: gerarEditor()
      });
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
      new ButtonBuilder().setCustomId('gerenciar_botoes').setLabel('Gerenciar botões').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Secondary),
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
