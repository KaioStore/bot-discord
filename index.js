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

// ===== BANCO DE BOTÕES =====
let botoesSalvos = {};

try {
  if (fs.existsSync('./botoes.json')) {
    botoesSalvos = JSON.parse(fs.readFileSync('./botoes.json', 'utf8'));
  }
} catch {
  botoesSalvos = {};
}

function salvarBotoes() {
  fs.writeFileSync('./botoes.json', JSON.stringify(botoesSalvos, null, 2));
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

    // ===== EDITAR EMBED (APPS) =====
if (interaction.isMessageContextMenuCommand()) {

  if (interaction.commandName === 'Editar Embed') {

    const dono = '123456789012345678';

    if (interaction.user.id !== dono) {
      return interaction.reply({
        content: 'Você não pode usar isso.',
        ephemeral: true
      });
    }

    const msg = interaction.targetMessage;

    if (!msg.embeds[0]) {
      return interaction.reply({
        content: 'Essa mensagem não tem embed.',
        ephemeral: true
      });
    }

    const embed = msg.embeds[0];

    const modal = new ModalBuilder()
      .setCustomId(`edit_${msg.id}`)
      .setTitle('Editar Embed');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('titulo')
          .setLabel('Título')
          .setStyle(TextInputStyle.Short)
          .setValue(embed.title || '')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('desc')
          .setLabel('Descrição')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(embed.description || '')
          .setRequired(false)
      )
    );

    return interaction.showModal(modal);
  }
}

    // 🔥 BOTÃO CORRIGIDO (SEM "Mensagem")
    if (interaction.isButton() && interaction.customId.startsWith('msg_')) {

  const botoes = botoesSalvos[interaction.message.id];

  if (!botoes) {
    return interaction.reply({
      content: 'Esse botão não está disponível.',
      ephemeral: true
    });
  }

  const index = Number(interaction.customId.split('_')[1]);
  const btn = botoes[index];

  if (!btn) {
    return interaction.reply({
      content: 'Botão inválido.',
      ephemeral: true
    });
  }

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor('#2b2d31')
        .setDescription(btn.valor)
    ],
    ephemeral: true
  });
}

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'embed') {

  if (!isAdmin) {
    return interaction.reply({
      content: 'Só administradores podem usar este comando.',
      ephemeral: true
    });
  }

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
          .setThumbnail('https://cdn.discordapp.com/attachments/1411723762260508702/1491216538177503313/Design_sem_nome.png?ex=69d6e320&is=69d591a0&hm=e23a4d3b84e0862162e5b70505a4069d3d08a5e4f3d94b3139ac9df63e690b47&/Design_sem_nome.png')
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

if (!session) return; // 🔥 evita crash

let atual = session.embeds[session.atual];

    if (interaction.isStringSelectMenu()) {
      session.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

     if (id === 'clear_buttons') {

  if (session.buttons.length === 0) {
    return interaction.reply({
      content: 'Não há botões para remover.',
      ephemeral: true
    });
  }

  session.buttons = [];

  return interaction.update({
    embeds: [montarEmbed(atual)],
    components: gerarMenu(interaction.user.id)
  });
}

      if (id === 'delete') {

  if (session.embeds.length <= 1) {
    return interaction.reply({
      content: 'Você precisa ter pelo menos 1 embed.',
      ephemeral: true
    });
  }

  session.embeds.splice(session.atual, 1);

  // Ajusta o índice
  if (session.atual >= session.embeds.length) {
    session.atual = session.embeds.length - 1;
  }

  return interaction.update({
    embeds: [montarEmbed(session.embeds[session.atual])],
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
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cor').setLabel('Cor: azul, verde, cinza, preto').setStyle(TextInputStyle.Short).setRequired(false)
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

        const msg = await interaction.channel.send({
  embeds: session.embeds.map(e => montarEmbed(e)),
  components: rows.length ? rows : []
});

// 🔥 salva os botões no arquivo
botoesSalvos[msg.id] = session.buttons;
salvarBotoes();

        return interaction.reply({ content: 'Enviado!', ephemeral: true });
      }

      if (['titulo','desc','imagem','thumb','autor'].includes(id)) {

        if (id === 'autor') {
          const modal = new ModalBuilder()
            .setCustomId('autor_modal')
            .setTitle('Autor');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('nome').setLabel('Nome do autor').setStyle(TextInputStyle.Short).setValue(atual.author?.nome || '').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('icon').setLabel('URL da imagem').setStyle(TextInputStyle.Short).setValue(atual.author?.icon || '').setRequired(false)
            )
          );

          return interaction.showModal(modal);
        }

        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle(`Editar ${id}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel(
                id === 'imagem' ? 'URL da imagem' :
                id === 'thumb' ? 'URL da thumbnail' :
                `Digite ${id}`
              )
              .setStyle(TextInputStyle.Paragraph)
              .setValue(
                id === 'titulo' ? (atual.title || '') :
                id === 'desc' ? (atual.description || '') :
                id === 'imagem' ? (atual.image || '') :
                id === 'thumb' ? (atual.thumbnail || '') :
                ''
              )
              .setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit()) {

      // ===== SALVAR EDIÇÃO DO EMBED =====
if (interaction.customId.startsWith('edit_')) {

  const msgId = interaction.customId.split('_')[1];
  let msg;

try {
  msg = await interaction.channel.messages.fetch(msgId);
} catch {
  return interaction.reply({
    content: 'Não consegui encontrar essa mensagem.',
    ephemeral: true
  });
}

  const titulo = interaction.fields.getTextInputValue('titulo');
  const desc = interaction.fields.getTextInputValue('desc');

  const embed = EmbedBuilder.from(msg.embeds[0])
    .setTitle(titulo || null)
    .setDescription(desc || null);

  await msg.edit({
    embeds: [embed]
  });

  return interaction.reply({
    content: 'Embed atualizado!',
    ephemeral: true
  });
}

      let atual = session.embeds[session.atual];

      if (interaction.customId === 'criar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');
        let cor = interaction.fields.getTextInputValue('cor')?.toLowerCase();

        let style = ButtonStyle.Secondary;
        if (cor === 'azul') style = ButtonStyle.Primary;
        if (cor === 'verde') style = ButtonStyle.Success;
        if (cor === 'preto') style = ButtonStyle.Secondary;

        session.buttons.push({ label, valor, style });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }

      if (interaction.customId === 'autor_modal') {
        const nome = interaction.fields.getTextInputValue('nome');
        const icon = interaction.fields.getTextInputValue('icon');

        atual.author = { nome, icon };

        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarEditor()
        });
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
      new ButtonBuilder().setCustomId('clear_buttons').setLabel('Remover botões').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
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

const { REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

const commands = [

  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Abrir painel de embed'),

  new SlashCommandBuilder()
    .setName('avaliar')
    .setDescription('Enviar avaliação')
    .addStringOption(option =>
      option.setName('texto')
        .setDescription('Digite a avaliação')
        .setRequired(true)
    ),

  // 🔥 NOVO (RIO BOT STYLE)
  new ContextMenuCommandBuilder()
    .setName('Editar Embed')
    .setType(ApplicationCommandType.Message)

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🧹 Limpando comandos antigos...');

    // REMOVE GLOBAL (causa duplicado)
    await rest.put(
      Routes.applicationCommands('1485623307364466861'),
      { body: [] }
    );

    // REMOVE DO SERVIDOR
    await rest.put(
      Routes.applicationGuildCommands('1485623307364466861', '1411478770824511652'),
      { body: [] }
    );

    console.log('✅ Limpo!');

    // REGISTRA CORRETAMENTE (1 VEZ SÓ)
    await rest.put(
      Routes.applicationGuildCommands('1485623307364466861', '1411478770824511652'),
      { body: commands }
    );

    console.log('🚀 Comandos registrados!');
  } catch (error) {
    console.error(error);
  }
})();

// ===== LOGIN =====
client.login(TOKEN);
