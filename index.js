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

// ===== BOT =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {

  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;

    // ===== COMANDOS =====
    if (interaction.isChatInputCommand()) {

      // ===== EMBED =====
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
              .setTitle('Editor de Embeds')
              .setDescription('Gerencie seus embeds abaixo')
          ],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

      // ===== SALDO =====
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

      // ===== GASTAR =====
      if (interaction.commandName === 'gastar') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        gastos[user.id] = (gastos[user.id] || 0) + valor;
        salvar();

        return interaction.reply({ content: `Adicionado R$${valor} para ${user.username}`, ephemeral: true });
      }

      // ===== REMOVER =====
      if (interaction.commandName === 'removergasto') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        gastos[user.id] = (gastos[user.id] || 0) - valor;
        if (gastos[user.id] < 0) gastos[user.id] = 0;
        salvar();

        return interaction.reply({ content: `Removido R$${valor} de ${user.username}`, ephemeral: true });
      }

      // ===== AVALIAR =====
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
          .setDescription(
`**•** Avaliação: ${texto}
**•** Total: ${db.total}
**•** Pedido: ${db.pedidos}`
          );

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }

      // ===== RANK =====
      if (interaction.commandName === 'rank') {

        const rankingArray = Object.entries(gastos)
          .sort(([,a],[,b]) => b - a);

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('🏆 Ranking de Gastos')
          .setDescription(
            rankingArray.map(([id, total], i) => {

              let vip = "Sem cargo";
              if (total >= 1000) vip = "Diamante";
              else if (total >= 500) vip = "Ouro";
              else if (total >= 300) vip = "Prata";
              else if (total >= 100) vip = "Bronze";

              let proxVip = '';
              let faltando = 0;

              if (vip === 'Sem cargo') { proxVip = 'Bronze'; faltando = 100 - total; }
              else if (vip === 'Bronze') { proxVip = 'Prata'; faltando = 300 - total; }
              else if (vip === 'Prata') { proxVip = 'Ouro'; faltando = 500 - total; }
              else if (vip === 'Ouro') { proxVip = 'Diamante'; faltando = 1000 - total; }

              return `**${i+1}º** - [<@${id}>](${SITE}/user/${id}) — R$${total} — 🏆 ${vip}
> Continue comprando para atingir **${proxVip}**${faltando > 0 ? ` (faltam R$${faltando})` : ''}`;
            }).join('\n\n')
          );

        return interaction.reply({ embeds: [embed] });
      }

    } // FECHA COMANDOS

    // ===== EMBED SYSTEM =====
    const session = embedSessions[interaction.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual];
    if (!atual) {
      session.embeds[session.atual] = {};
      atual = session.embeds[session.atual];
    }

    if (interaction.isStringSelectMenu()) {
      session.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    if (interaction.isButton()) {

      if (interaction.customId === 'add_embed') {
        session.embeds.push({});
        session.atual = session.embeds.length - 1;
      }

      if (interaction.customId === 'delete') {
        session.embeds.splice(session.atual, 1);
        if (session.embeds.length === 0) session.embeds.push({});
        session.atual = 0;
      }

      if (interaction.customId === 'edit') {
        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarEditor()
        });
      }

      if (interaction.customId === 'voltar') {
        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (interaction.customId === 'buttons') {
        const modal = new ModalBuilder()
          .setCustomId('btn_create')
          .setTitle('Criar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Texto').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Link ou mensagem').setStyle(TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'enviar') {

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

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    if (interaction.isModalSubmit()) {

      if (interaction.customId === 'btn_create') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');

        session.buttons.push({ label, valor });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }

      const valor = interaction.fields.getTextInputValue('input') || '⠀';

      if (!session.embeds[session.atual]) session.embeds[session.atual] = {};

      if (interaction.customId === 'titulo') session.embeds[session.atual].title = valor;
      if (interaction.customId === 'desc') session.embeds[session.atual].description = valor;
      if (interaction.customId === 'imagem') session.embeds[session.atual].image = valor;
      if (interaction.customId === 'thumb') session.embeds[session.atual].thumbnail = valor;

      if (interaction.customId === 'autor') {
        session.embeds[session.atual].author = {
          nome: valor,
          url: valor.startsWith('http') ? valor : null
        };
      }

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
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
  if (data.description) embed.setDescription(data.description);
  else embed.setDescription('⠀');

  if (data.image) embed.setImage(data.image);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  if (data.author) {
    embed.setAuthor({
      name: data.author.nome || data.author,
      url: data.author.url || null
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
      new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('delete').setLabel('Deletar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('buttons').setLabel('Botões').setStyle(ButtonStyle.Primary),
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
      new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(ButtonStyle.Primary)
    )
  ];
}

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot online');
});

app.listen(PORT, () => {
  console.log('Servidor web rodando na porta ' + PORT);
});

// ===== LOGIN =====
client.login(TOKEN);
setInterval(() => {}, 1000);
