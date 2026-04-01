// 🔥 NÃO TRATADOS
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

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

const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== BANCO =====
let db = { total: 427, pedidos: 458, embedsSalvos: {} };
if (fs.existsSync('./db.json')) {
  db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
}
const salvar = () => fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));

// ===== SESSÕES =====
const embedSessions = {};

// ===== READY =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    // 🔥 BOTÃO GLOBAL (FUNCIONA PRA TODOS)
    if (interaction.isButton() && interaction.customId.startsWith('msg_')) {
      const texto = interaction.customId.slice(4);
      return interaction.reply({ content: texto, ephemeral: true });
    }

    // 🔥 EDITAR EMBED DEPOIS
    if (interaction.isButton() && interaction.customId.startsWith('editarEmbed_')) {
      const id = interaction.customId.split('_')[1];
      const salvo = db.embedsSalvos[id];

      if (!salvo) return interaction.reply({ content: 'Embed não encontrado.', ephemeral: true });

      embedSessions[interaction.user.id] = JSON.parse(JSON.stringify(salvo));

      return interaction.reply({
        content: 'Embed carregado para edição!',
        embeds: [montarEmbed(salvo.embeds[0])],
        components: gerarMenu(interaction.user.id),
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
          buttons: []
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
          description: 'Lembre-se que seu Embed não pode ser vazio!'
        });
        session.atual = session.embeds.length - 1;
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

      // ===== SALVAR EMBED
      if (id === 'salvar') {
        const idSalvo = Date.now().toString();

        db.embedsSalvos[idSalvo] = session;
        salvar();

        return interaction.reply({ content: `Salvo com ID: ${idSalvo}`, ephemeral: true });
      }

      if (id === 'add_button') {
        return abrirModal(interaction, 'criar_botao');
      }

      // ===== GERENCIAR BOTÕES
      if (id === 'gerenciar') {
        if (session.buttons.length === 0) {
          return interaction.reply({ content: 'Sem botões.', ephemeral: true });
        }

        const rows = session.buttons.map((b, i) =>
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`edit_btn_${i}`)
              .setLabel(`Editar ${b.label}`)
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`del_btn_${i}`)
              .setLabel('Excluir')
              .setStyle(ButtonStyle.Danger)
          )
        );

        return interaction.update({ components: rows });
      }

      if (id.startsWith('edit_btn_')) {
        session.editando = Number(id.split('_')[2]);
        return abrirModal(interaction, 'edit_btn');
      }

      if (id.startsWith('del_btn_')) {
        const index = Number(id.split('_')[2]);
        session.buttons.splice(index, 1);
      }

      // ===== ENVIAR
      if (id === 'enviar') {
        const idSalvo = Date.now().toString();
        db.embedsSalvos[idSalvo] = session;
        salvar();

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
              new ButtonBuilder().setLabel(btn.label).setStyle(btn.style).setCustomId(`msg_${btn.valor}`)
            );
          }
        });

        if (row.components.length > 0) rows.push(row);

        // BOTÃO DE EDITAR DEPOIS
        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`editarEmbed_${idSalvo}`)
              .setLabel('Editar embed')
              .setStyle(ButtonStyle.Secondary)
          )
        );

        await interaction.channel.send({
          embeds: session.embeds.map(montarEmbed),
          components: rows
        });

        return interaction.reply({ content: 'Enviado e salvo!', ephemeral: true });
      }

      return interaction.update({
        embeds: [montarEmbed(atual)],
        components: gerarMenu(interaction.user.id)
      });
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

      if (interaction.customId === 'criar_botao' || interaction.customId === 'edit_btn') {

        const label = interaction.fields.getTextInputValue('input');
        const valor = interaction.fields.getTextInputValue('input2');
        const cor = interaction.fields.getTextInputValue('input3')?.toLowerCase();

        let style = ButtonStyle.Secondary;
        if (cor === 'azul') style = ButtonStyle.Primary;
        if (cor === 'verde') style = ButtonStyle.Success;

        const data = { label, valor, style };

        if (interaction.customId === 'criar_botao') {
          session.buttons.push(data);
        } else {
          session.buttons[session.editando] = data;
        }

        return interaction.reply({ content: 'Botão salvo!', ephemeral: true });
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
  const s = embedSessions[userId];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .addOptions(s.embeds.map((_, i) => ({
          label: `Embed ${i + 1}`,
          value: `${i}`
        })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('add_button').setLabel('Criar botão').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('gerenciar').setLabel('Gerenciar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('salvar').setLabel('Salvar').setStyle(ButtonStyle.Secondary),
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
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumb').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(ButtonStyle.Primary)
    )
  ];
}

function abrirModal(i, id) {
  const modal = new ModalBuilder().setCustomId(id).setTitle('Botão');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('input').setLabel('Nome').setStyle(TextInputStyle.Short)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('input2').setLabel('Mensagem ou link').setStyle(TextInputStyle.Paragraph)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('input3').setLabel('Cor (azul, verde, cinza)').setStyle(TextInputStyle.Short).setRequired(false)
    )
  );

  return i.showModal(modal);
}

// ===== WEB =====
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot online'));
app.listen(PORT);

client.login(TOKEN);
