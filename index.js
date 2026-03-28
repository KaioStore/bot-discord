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

const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';
const SITE = 'https://kaio-rank.vercel.app';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== BANCO =====
let db = { total: 419, pedidos: 450 };
let gastos = {};

if (fs.existsSync('./db.json')) {
  db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
}

if (fs.existsSync('./gastos.json')) {
  gastos = JSON.parse(fs.readFileSync('./gastos.json', 'utf8'));
}

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

    // ================= COMANDOS =================
    if (interaction.isChatInputCommand()) {

      // EMBED
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
              .setDescription('Use os botões abaixo para editar')
          ],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

      // SALDO
      if (interaction.commandName === 'saldo') {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const total = gastos[user.id] || 0;

        let vip = "Sem cargo";
        if (total >= 1000) vip = "Diamante";
        else if (total >= 500) vip = "Ouro";
        else if (total >= 300) vip = "Prata";
        else if (total >= 100) vip = "Bronze";

        return interaction.reply({
          content: `💰 ${user.username} gastou: R$${total}\n🏆 VIP: ${vip}`,
          ephemeral: true
        });
      }

      // GASTAR
      if (interaction.commandName === 'gastar') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        gastos[user.id] = (gastos[user.id] || 0) + valor;
        salvar();

        return interaction.reply({ content: `Adicionado R$${valor} para ${user.username}`, ephemeral: true });
      }

      // REMOVER
      if (interaction.commandName === 'removergasto') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        gastos[user.id] = Math.max(0, (gastos[user.id] || 0) - valor);
        salvar();

        return interaction.reply({ content: `Removido R$${valor} de ${user.username}`, ephemeral: true });
      }

      // AVALIAR (COMPLETO)
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

      // RANK
      if (interaction.commandName === 'rank') {
        const rankingArray = Object.entries(gastos).sort(([,a],[,b]) => b - a);

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('🏆 Top Clientes')
          .setDescription(
            rankingArray.map(([id, total], i) => {
              return `**${i+1}º** - [<@${id}>](${SITE}/user/${id})
💰 Total: R$${total}`;
            }).join('\n\n')
          );

        return interaction.reply({ embeds: [embed] });
      }
    }

    // ================= EMBED SYSTEM =================
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
          .setTitle('Editar');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel('Editar')
              .setStyle(id === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setValue(valorAtual)
          )
        );

        return interaction.showModal(modal);
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
            new TextInputBuilder().setCustomId('valor').setLabel('Link ou mensagem').setStyle(TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

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
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('add_button').setLabel('Adicionar Botão').setStyle(ButtonStyle.Primary),
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
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('autor').setLabel('Autor').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('autor_url').setLabel('Link Autor').setStyle(ButtonStyle.Secondary)
    )
  ];
}

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot online');
});

app.listen(PORT, () => {
  console.log('Servidor rodando');
});

client.login(TOKEN);
