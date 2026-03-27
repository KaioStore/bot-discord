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
  StringSelectMenuBuilder
} = require('discord.js');

const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';

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
}
function salvarGastos() {
  fs.writeFileSync('./gastos.json', JSON.stringify(gastos, null, 2));
}

// ===== EMBED SYSTEM =====
const embedSessions = {};

function gerarEmbed(data) {
  return new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(data.title || null)
    .setDescription(data.description || 'Sem descrição')
    .setImage(data.image || null)
    .setThumbnail(data.thumb || null);
}

// ===== BOT =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {

  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // =========================
    // ===== COMANDOS =====
    // =========================
    if (interaction.isChatInputCommand()) {

      // ===== EMBED =====
      if (interaction.commandName === 'embed') {

        embedSessions[interaction.user.id] = {
          lista: [{}],
          atual: 0,
          page: 'menu'
        };

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#2b2d31')
              .setTitle('Painel de Embeds')
              .setDescription('Gerencie seus embeds')
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('select_embed')
                .setPlaceholder('Selecionar embed')
                .addOptions([{ label: 'Embed 1', value: '0' }])
            ),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('edit_embed').setLabel('Editar').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('send_embed').setLabel('Enviar').setStyle(ButtonStyle.Success)
            )
          ]
        });
      }

      // ===== SALDO (SEU ORIGINAL) =====
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

      // ===== AVALIAR (SEU ORIGINAL COMPLETO) =====
      if (interaction.commandName === 'avaliar') {

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: 'Só administradores podem usar esse comando.', ephemeral: true });
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

      // ===== GASTAR (SEU ORIGINAL) =====
      if (interaction.commandName === 'gastar') {

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        if (!gastos[user.id]) gastos[user.id] = 0;
        gastos[user.id] += valor;

        salvarGastos();

        return interaction.reply({
          content: `Gasto adicionado para ${user.username}`,
          ephemeral: true
        });
      }

      // ===== REMOVER =====
      if (interaction.commandName === 'removergasto') {

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        if (!gastos[user.id]) gastos[user.id] = 0;

        gastos[user.id] -= valor;

        if (gastos[user.id] <= 0) delete gastos[user.id];

        salvarGastos();

        return interaction.reply({
          content: `Gasto removido de ${user.username}`,
          ephemeral: true
        });
      }

      // ===== RANK (SEU ORIGINAL) =====
      if (interaction.commandName === 'rank') {

        await interaction.deferReply();

        const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);

        let texto = '';

        for (let i = 0; i < ranking.length; i++) {
          texto += `${i+1}. <@${ranking[i][0]}> - R$${ranking[i][1]}\n`;
        }

        return interaction.editReply({ content: texto || 'Sem dados.' });
      }

    }

    // =========================
    // ===== EMBED INTERAÇÕES =====
    // =========================

    const s = embedSessions[interaction.user.id];
    if (!s) return;

    // SELECT
    if (interaction.isStringSelectMenu()) {
      s.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [gerarEmbed(s.lista[s.atual])]
      });
    }

    // BOTÕES
    if (interaction.isButton()) {

      const atual = s.lista[s.atual];

      if (interaction.customId === 'add_embed') {
        s.lista.push({});
      }

      if (interaction.customId === 'edit_embed') {

        return interaction.update({
          embeds: [gerarEmbed(atual)],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('imagem').setLabel('Imagem').setStyle(ButtonStyle.Secondary)
            ),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('back').setLabel('Voltar').setStyle(ButtonStyle.Primary)
            )
          ]
        });
      }

      if (interaction.customId === 'back') {
        return interaction.update({
          content: 'Menu',
          embeds: [],
          components: []
        });
      }

      if (interaction.customId === 'send_embed') {
        return interaction.channel.send({
          embeds: s.lista.map(e => gerarEmbed(e))
        });
      }

      return interaction.update({
        embeds: [gerarEmbed(atual)]
      });
    }

  } catch (err) {
    console.error(err);
  }

});

client.login(TOKEN);
