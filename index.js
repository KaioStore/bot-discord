process.on('uncaughtException', (err) => console.error(err));
process.on('unhandledRejection', (err) => console.error(err));

const { 
  Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
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
function gerarEmbed(data) {
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

// ===== API (mantido) =====
app.listen(3000, () => console.log('Web server ligado'));

// ===== READY =====
client.on('ready', () => {
  console.log(`Online: ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
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

    // ===== AVALIAR =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'avaliar') {

      if (!isAdmin) return interaction.reply({ content: 'Só admins.', ephemeral: true });

      const texto = interaction.options.getString('texto');

      db.total++;
      db.pedidos++;

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('**Avaliação Recebida! 🖤**')
        .setThumbnail('https://cdn.discordapp.com/attachments/1411723762260508702/1473016671240323103/Design_sem_nome.png')
        .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
        .setDescription(`**•** Avaliação: ${texto}\n**•** Total: ${db.total}\n**•** Pedido: ${db.pedidos}`);

      const canal = client.channels.cache.get(CANAL_AVALIACOES);
      if (canal) canal.send({ embeds: [embed] });

      return interaction.reply({ content: 'Avaliação enviada.', ephemeral: true });
    }

    // ===== EMBED =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {

      if (!isAdmin) return interaction.reply({ content: 'Apenas admins.', ephemeral: true });

      embedSessions[interaction.user.id] = {
        lista: [{}],
        atual: 0,
        modo: 'menu'
      };

      return interaction.reply({
        embeds: [gerarEmbed({})],
        components: painel(embedSessions[interaction.user.id]),
        ephemeral: true
      });
    }

    // ===== SELECT =====
    if (interaction.isStringSelectMenu()) {
      const s = embedSessions[interaction.user.id];
      if (!s) return;

      s.atual = Number(interaction.values[0]);
      s.modo = 'edit';

      return atualizarPainel(interaction);
    }

    // ===== BOTÕES =====
    if (interaction.isButton()) {

      const s = embedSessions[interaction.user.id];
      if (!s) return;

      const atual = s.lista[s.atual];

      if (interaction.customId === 'add') {
        s.lista.push({});
        s.atual = s.lista.length - 1;
        return atualizarPainel(interaction);
      }

      if (interaction.customId === 'voltar') {
        s.modo = 'menu';
        return atualizarPainel(interaction);
      }

      if (interaction.customId === 'deletar') {
        s.lista.splice(s.atual, 1);
        if (s.lista.length === 0) s.lista.push({});
        s.atual = 0;
        s.modo = 'menu';
        return atualizarPainel(interaction);
      }

      if (interaction.customId === 'enviar') {
        await interaction.channel.send({
          embeds: s.lista.map(e => gerarEmbed(e))
        });

        return interaction.reply({ content: 'Enviado!', ephemeral: true });
      }

      function modal(id, label, value, big = false) {
        return new ModalBuilder()
          .setCustomId(id)
          .setTitle('Editar')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('input')
                .setLabel(label)
                .setStyle(big ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setValue(value || "")
            )
          );
      }

      if (interaction.customId === 'titulo')
        return interaction.showModal(modal('titulo','Título',atual.title));

      if (interaction.customId === 'desc')
        return interaction.showModal(modal('desc','Descrição',atual.description,true));

      if (interaction.customId === 'img')
        return interaction.showModal(modal('img','Imagem',atual.image));

      if (interaction.customId === 'thumb')
        return interaction.showModal(modal('thumb','Thumbnail',atual.thumb));

      if (interaction.customId === 'autor') {
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId('autor')
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
            )
        );
      }
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

      const s = embedSessions[interaction.user.id];
      if (!s) return;

      const atual = s.lista[s.atual];

      if (interaction.customId === 'autor') {
        atual.author = interaction.fields.getTextInputValue('nome');
        atual.authorIcon = interaction.fields.getTextInputValue('icon');
      } else {
        const v = interaction.fields.getTextInputValue('input');

        if (interaction.customId === 'titulo') atual.title = v;
        if (interaction.customId === 'desc') atual.description = v;
        if (interaction.customId === 'img') atual.image = v;
        if (interaction.customId === 'thumb') atual.thumb = v;
      }

      return atualizarPainel(interaction);
    }

  } catch (err) {
    console.error(err);
  }

});

// ===== UI =====
function painel(s) {

  if (s.modo === 'menu') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('select')
      .setPlaceholder('Selecionar embed')
      .addOptions(
        s.lista.map((_,i)=>({
          label:`Embed ${i+1}`,
          value:`${i}`
        }))
      );

    return [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('add').setLabel('Adicionar Embed').setStyle(2),
        new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(3)
      )
    ];
  }

  if (s.modo === 'edit') {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(2),
        new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(2)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('img').setLabel('Imagem').setStyle(2),
        new ButtonBuilder().setCustomId('thumb').setLabel('Thumbnail').setStyle(2)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('autor').setLabel('Autor').setStyle(2)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(1),
        new ButtonBuilder().setCustomId('deletar').setLabel('Deletar').setStyle(4)
      )
    ];
  }
}

// ===== UPDATE =====
function atualizarPainel(interaction) {
  const s = embedSessions[interaction.user.id];

  if (s.modo === 'menu') {
    return interaction.update({
      embeds: s.lista.map(e => gerarEmbed(e)),
      components: painel(s)
    });
  }

  return interaction.update({
    embeds: [gerarEmbed(s.lista[s.atual])],
    components: painel(s)
  });
}

client.login(TOKEN);
setInterval(() => {}, 1000);
