// ===== NÃO MEXI NO INÍCIO =====
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
  TextInputStyle
} = require('discord.js');

const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';
const SITE = 'https://kaio-rank.vercel.app';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

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
  console.log(`Logado como ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;

    // ===== COMANDOS =====
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'embed') {
        embedSessions[interaction.user.id] = {
          embeds: [{}],
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

      // ===== AVALIAÇÃO (NÃO REMOVIDO) =====
      if (interaction.commandName === 'avaliar') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

        const texto = interaction.options.getString('texto');

        await interaction.deferReply({ ephemeral: true });

        db.total++;
        db.pedidos++;
        salvar();

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('**Avaliação Recebida! 🖤**')
          .setThumbnail('https://cdn.discordapp.com/attachments/1411723762260508702/1473016671240323103/Design_sem_nome.png')
          .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
          .setDescription(`**•** Avaliação: ${texto}
**•** Total: ${db.total}
**•** Pedido: ${db.pedidos}`);

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }

      // ===== OUTROS COMANDOS (mantidos) =====
      if (interaction.commandName === 'saldo') {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const total = gastos[user.id] || 0;
        return interaction.reply({ content: `💰 R$${total}`, ephemeral: true });
      }

      if (interaction.commandName === 'rank') {
        const rankingArray = Object.entries(gastos).sort(([,a],[,b]) => b - a);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#2b2d31')
              .setTitle('🏆 Ranking')
              .setDescription(
                rankingArray.map(([id, total], i) =>
                  `**${i+1}º** <@${id}> - R$${total}`
                ).join('\n')
              )
          ]
        });
      }
    }

    // ===== EMBED SYSTEM =====
    const session = embedSessions[interaction.user.id];
    if (!session) return;

    if (!session.embeds[session.atual]) {
      session.embeds[session.atual] = {};
    }

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

      // 🔥 INPUT COM VALOR SALVO (CORREÇÃO DO BUG)
      if (['titulo','desc','imagem','thumb','autor','autor_url'].includes(id)) {

        let valorAtual = '';
        if (id === 'titulo') valorAtual = atual.title || '';
        if (id === 'desc') valorAtual = atual.description || '';
        if (id === 'imagem') valorAtual = atual.image || '';
        if (id === 'thumb') valorAtual = atual.thumbnail || '';
        if (id === 'autor') valorAtual = atual.author?.nome || '';
        if (id === 'autor_url') valorAtual = atual.author?.url || '';

        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle('Editar')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('input')
                .setLabel('Digite')
                .setValue(valorAtual) // 🔥 ISSO RESOLVE O BUG
                .setStyle(id === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            )
          );

        return interaction.showModal(modal);
      }

      // ADICIONAR BOTÃO
      if (id === 'add_button') {
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId('criar_botao')
            .setTitle('Criar botão')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('label').setLabel('Nome').setStyle(TextInputStyle.Short)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('valor').setLabel('Link ou mensagem').setStyle(TextInputStyle.Short)
              )
            )
        );
      }

      // ADD EMBED
      if (id === 'add_embed') {
        session.embeds.push({});
        session.atual = session.embeds.length - 1;
      }

      // DELETE
      if (id === 'delete') {
        session.embeds.splice(session.atual, 1);
        if (session.embeds.length === 0) session.embeds.push({});
        session.atual = 0;
      }

      // ENVIAR
      if (id === 'enviar') {
        await interaction.channel.send({
          embeds: session.embeds.map(e => montarEmbed(e))
        });

        return interaction.reply({ content: 'Enviado!', ephemeral: true });
      }

      return interaction.update({
        embeds: [montarEmbed(atual)],
        components: gerarMenu(interaction.user.id)
      });
    }

    // MODAL
    if (interaction.isModalSubmit()) {

      if (interaction.customId === 'criar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');

        session.buttons.push({ label, valor });
        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }

      const valor = interaction.fields.getTextInputValue('input') || '⠀';

      if (interaction.customId === 'titulo') atual.title = valor;
      if (interaction.customId === 'desc') atual.description = valor;
      if (interaction.customId === 'imagem') atual.image = valor;
      if (interaction.customId === 'thumb') atual.thumbnail = valor;

      if (interaction.customId === 'autor') {
        if (!atual.author) atual.author = {};
        atual.author.nome = valor;
      }

      if (interaction.customId === 'autor_url') {
        if (!atual.author) atual.author = {};
        atual.author.url = valor;
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

// ===== FUNÇÕES =====
function montarEmbed(data) {
  const embed = new EmbedBuilder().setColor('#2b2d31');

  if (data.title) embed.setTitle(data.title);
  embed.setDescription(data.description || '⠀');

  if (data.image) embed.setImage(data.image);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  if (data.author) {
    embed.setAuthor({
      name: data.author.nome || '⠀',
      url: data.author.url || undefined
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
      new ButtonBuilder().setCustomId('delete').setLabel('Deletar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('add_button').setLabel('Adicionar Botão').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
    )
  ];
}

// ===== WEB =====
app.listen(process.env.PORT || 3000, () => console.log('Servidor rodando'));
client.login(TOKEN);
