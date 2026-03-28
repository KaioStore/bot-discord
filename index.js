// ===== ERROS =====
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

client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;

    // ================= COMANDOS =================
    if (interaction.isChatInputCommand()) {

      // ===== EMBED =====
      if (interaction.commandName === 'embed') {
        embedSessions[interaction.user.id] = embedSessions[interaction.user.id] || {
          embeds: [{}],
          atual: 0,
          buttons: []
        };

        return interaction.reply({
          embeds: [montarEmbed(embedSessions[interaction.user.id].embeds[0])],
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

      // ===== AVALIAR (SEU ORIGINAL) =====
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

      // ===== RANK (SEU ORIGINAL COMPLETO) =====
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

    }

    // ===== EMBED SYSTEM FIX =====
    const session = embedSessions[interaction.user.id];
    if (!session) return;

    const atual = session.embeds[session.atual] ||= {};

    if (interaction.isButton()) {

      const id = interaction.customId;

      if (['titulo','desc','imagem','thumb','autor'].includes(id)) {
        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle('Editar');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel('Digite')
              .setStyle(id === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

      if (id === 'add_button') {
        const modal = new ModalBuilder()
          .setCustomId('btn')
          .setTitle('Criar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Texto').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('link').setLabel('Link').setStyle(TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

    }

    if (interaction.isModalSubmit()) {

      const valor = interaction.fields.getTextInputValue('input');

      if (interaction.customId === 'titulo') atual.title = valor;
      if (interaction.customId === 'desc') atual.description = valor;
      if (interaction.customId === 'imagem') atual.image = valor;
      if (interaction.customId === 'thumb') atual.thumbnail = valor;

      if (interaction.customId === 'autor') {
        atual.author = {
          nome: valor,
          url: valor.startsWith('http') ? valor : undefined
        };
      }

      return interaction.update({
        embeds: [montarEmbed(atual)]
      });
    }

  } catch (err) {
    console.error(err);
  }
});

// ===== FUNÇÃO EMBED =====
function montarEmbed(data) {
  const embed = new EmbedBuilder().setColor('#2b2d31');

  if (data.title) embed.setTitle(data.title);
  embed.setDescription(data.description || '⠀');

  if (data.image) embed.setImage(data.image);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  if (data.author) {
    embed.setAuthor({
      name: data.author.nome || '⠀',
      url: data.author.url
    });
  }

  return embed;
}

// WEB
const PORT = process.env.PORT || 3000;
app.get('/', (req,res)=>res.send('online'));
app.listen(PORT);

client.login(TOKEN);
