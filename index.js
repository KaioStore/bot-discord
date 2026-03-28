// ===== ERROS =====
process.on('uncaughtException', (err) => console.error(err));
process.on('unhandledRejection', (err) => console.error(err));

// ===== IMPORTS =====
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
const SITE = 'https://kaio-rank.vercel.app';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== CORES BOTÕES =====
const styleMap = {
  Primary: ButtonStyle.Primary,
  Success: ButtonStyle.Success,
  Secondary: ButtonStyle.Secondary,
  Danger: ButtonStyle.Danger
};

// ===== BANCO =====
let db = { total: 419, pedidos: 450 };
let gastos = {};

if (fs.existsSync('./db.json')) db = JSON.parse(fs.readFileSync('./db.json'));
if (fs.existsSync('./gastos.json')) gastos = JSON.parse(fs.readFileSync('./gastos.json'));

function salvar() {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
  fs.writeFileSync('./gastos.json', JSON.stringify(gastos, null, 2));
}

// ===== EMBED SYSTEM =====
const embedSessions = {};

client.on('ready', () => {
  console.log(`✅ Logado como ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // ===== COMANDOS =====
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'embed') {
        embedSessions[interaction.user.id] = {
          embeds: [{}],
          atual: 0,
          buttons: []
        };

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#2b2d31').setTitle('Painel Embed')],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

      if (interaction.commandName === 'avaliar') {
        if (!isAdmin) return interaction.reply({ content: 'Só admin', ephemeral: true });

        const texto = interaction.options.getString('texto');

        db.total++;
        db.pedidos++;
        salvar();

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('**Avaliação Recebida! 🖤**')
          .setThumbnail('https://cdn.discordapp.com/attachments/1411723762260508702/1473016671240323103/Design_sem_nome.png')
          .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
          .setDescription(`**•** Avaliação: ${texto}\n**•** Total: ${db.total}\n**•** Pedido: ${db.pedidos}`);

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.reply({ content: 'Enviado', ephemeral: true });
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

      // RESPOSTA BOTÃO
      if (id.startsWith('msg_')) {
        const btn = session.buttons[Number(id.split('_')[1])];
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription(btn.valor)],
          ephemeral: true
        });
      }

      // EDITAR CAMPOS
      if (['titulo','desc','imagem','thumb','autor'].includes(id)) {

        let valorAtual = '';

        if (id === 'titulo') valorAtual = atual.title || '';
        if (id === 'desc') valorAtual = atual.description || '';
        if (id === 'imagem') valorAtual = atual.image || '';
        if (id === 'thumb') valorAtual = atual.thumbnail || '';

        if (id === 'autor') {
          valorAtual = `${atual.author?.nome || ''} | ${atual.author?.icon || ''} | ${atual.author?.url || ''}`;
        }

        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle('Editar');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel(id === 'autor' ? 'Nome | URL imagem | URL clicável' : 'Digite')
              .setStyle(id === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setValue(valorAtual)
          )
        );

        return interaction.showModal(modal);
      }

      // CRIAR BOTÃO
      if (id === 'add_button') {
        const modal = new ModalBuilder()
          .setCustomId('criar_botao')
          .setTitle('Criar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Nome').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Mensagem ou link').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cor').setLabel('Cor (Primary, Success...)').setStyle(TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

      if (id === 'add_embed') {
        session.embeds.push({});
        session.atual = session.embeds.length - 1;
      }

      if (id === 'delete') {
        session.embeds.splice(session.atual, 1);
        session.atual = 0;
      }

      if (id === 'enviar') {

        const rows = [];
        let row = new ActionRowBuilder();

        session.buttons.forEach((btn, i) => {

          if (i % 5 === 0 && i !== 0) {
            rows.push(row);
            row = new ActionRowBuilder();
          }

          row.addComponents(
            new ButtonBuilder()
              .setLabel(btn.label)
              .setStyle(styleMap[btn.style] || ButtonStyle.Primary)
              .setCustomId(`msg_${i}`)
          );
        });

        if (row.components.length) rows.push(row);

        await interaction.channel.send({
          embeds: session.embeds.map(e => montarEmbed(e)),
          components: rows
        });

        return interaction.reply({ content: 'Enviado!', ephemeral: true });
      }

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

      if (interaction.customId === 'criar_botao') {
        session.buttons.push({
          label: interaction.fields.getTextInputValue('label'),
          valor: interaction.fields.getTextInputValue('valor'),
          style: interaction.fields.getTextInputValue('cor')
        });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }

      const valor = interaction.fields.getTextInputValue('input');

      if (interaction.customId === 'titulo') atual.title = valor;
      if (interaction.customId === 'desc') atual.description = valor;
      if (interaction.customId === 'imagem') atual.image = valor;
      if (interaction.customId === 'thumb') atual.thumbnail = valor;

      if (interaction.customId === 'autor') {
        const [nome, icon, url] = valor.split('|');
        atual.author = {
          nome: nome?.trim(),
          icon: icon?.trim(),
          url: url?.trim()
        };
      }

      return interaction.update({
        embeds: [montarEmbed(atual)],
        components: gerarMenu(interaction.user.id)
      });
    }

  } catch (err) {
    console.error(err);
  }
});

// ===== EMBED =====
function montarEmbed(data) {
  const embed = new EmbedBuilder().setColor('#2b2d31');

  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);

  if (data.image) embed.setImage(data.image);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  if (data.author?.nome) {
    embed.setAuthor({
      name: data.author.nome,
      iconURL: data.author.icon || undefined,
      url: data.author.url || undefined
    });
  }

  return embed;
}

// ===== MENU =====
function gerarMenu(userId) {
  const session = embedSessions[userId];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .addOptions(session.embeds.map((e,i)=>({
          label:`Embed ${i+1}`,
          value:`${i}`
        })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('add_button').setLabel('Adicionar Botões').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('delete').setLabel('Deletar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
    )
  ];
}

// ===== WEB =====
app.get('/', (req, res) => res.send('Bot online'));
app.listen(process.env.PORT || 3000);

// ===== LOGIN =====
client.login(TOKEN);
