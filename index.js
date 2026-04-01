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

// CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1485623307364466861';
const GUILD_ID = '1411478770824511652';
const CANAL_AVALIACOES = '1411493010268753930';

// CLIENT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// BANCO
let db = { total: 427, pedidos: 458 };
if (fs.existsSync('./db.json')) {
  db = JSON.parse(fs.readFileSync('./db.json'));
}
const salvar = () => fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));

// SESSÕES
const embedSessions = {};

// READY
client.once('ready', async () => {
  console.log(`Logado como ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [
      {
        name: 'avaliar',
        description: 'Enviar avaliação',
        options: [{
          name: 'texto',
          type: 3,
          required: true
        }]
      },
      {
        name: 'embed',
        description: 'Criar embed'
      }
    ]
  });
});

// INTERAÇÕES
client.on('interactionCreate', async (interaction) => {
  try {

    // BOTÃO GLOBAL
    if (interaction.isButton() && interaction.customId.startsWith('msg_')) {
      return interaction.reply({
        content: interaction.customId.slice(4),
        ephemeral: true
      });
    }

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // COMANDOS
    if (interaction.isChatInputCommand()) {

      // EMBED
      if (interaction.commandName === 'embed') {
        embedSessions[interaction.user.id] = {
          embeds: [{
            title: 'Novo Embed',
            description: 'Edite aqui'
          }],
          atual: 0,
          buttons: [],
          editando: null
        };

        return interaction.reply({
          embeds: [montarEmbed(embedSessions[interaction.user.id].embeds[0])],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

      // AVALIAÇÃO COMPLETA
      if (interaction.commandName === 'avaliar') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

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

        client.channels.cache.get(CANAL_AVALIACOES)?.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }
    }

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
        session.embeds.push({ title: 'Novo Embed', description: 'Edite aqui' });
        session.atual = session.embeds.length - 1;
      }

      if (id === 'delete') {
        session.embeds.splice(session.atual, 1);
        if (session.embeds.length === 0) {
          session.embeds.push({ title: 'Novo Embed', description: 'Edite aqui' });
        }
        session.atual = 0;
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
          .setTitle('Criar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Nome').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Mensagem').setStyle(TextInputStyle.Paragraph)
          )
        );

        return interaction.showModal(modal);
      }

      if (id === 'gerenciar') {
        const rows = session.buttons.map((b,i)=>
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`edit_btn_${i}`).setLabel(b.label).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`del_btn_${i}`).setLabel('Excluir').setStyle(ButtonStyle.Secondary)
          )
        );

        return interaction.update({ components: rows });
      }

      if (id === 'enviar') {
        const row = new ActionRowBuilder();

        session.buttons.forEach(b=>{
          row.addComponents(
            new ButtonBuilder()
              .setLabel(b.label)
              .setStyle(ButtonStyle.Primary)
              .setCustomId(`msg_${b.valor}`)
          );
        });

        await interaction.channel.send({
          embeds: session.embeds.map(montarEmbed),
          components: row.components.length ? [row] : []
        });

        return interaction.reply({ content: 'Enviado!', ephemeral: true });
      }

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    // MODAL
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'criar_botao') {
        session.buttons.push({
          label: interaction.fields.getTextInputValue('label'),
          valor: interaction.fields.getTextInputValue('valor')
        });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }
    }

  } catch (err) {
    console.error(err);
  }
});

// FUNÇÕES
function montarEmbed(data) {
  const e = new EmbedBuilder().setColor('#2b2d31');
  if (data.title) e.setTitle(data.title);
  if (data.description) e.setDescription(data.description);
  if (data.image) e.setImage(data.image);
  if (data.thumbnail) e.setThumbnail(data.thumbnail);
  if (data.author) e.setAuthor({ name: data.author });
  return e;
}

function gerarMenu(id) {
  const s = embedSessions[id];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .addOptions(s.embeds.map((_,i)=>({ label:`Embed ${i+1}`, value:`${i}` })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('delete').setLabel('Excluir').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('add_button').setLabel('Botão').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Primary),
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

// WEB
app.get('/', (req, res) => res.send('online'));
app.listen(process.env.PORT || 3000);

// LOGIN
client.login(TOKEN);
