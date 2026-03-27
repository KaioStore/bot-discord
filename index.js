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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

// ===== BANCO AVALIAÇÕES =====
let db = { total: 419, pedidos: 450 };

try {
  if (fs.existsSync('./db.json')) {
    db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
  }
} catch {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

function salvar() {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

// ===== BANCO GASTOS =====
let gastos = {};

try {
  if (fs.existsSync('./gastos.json')) {
    const conteudo = fs.readFileSync('./gastos.json', 'utf8');
    gastos = conteudo ? JSON.parse(conteudo) : {};
  }
} catch {
  gastos = {};
  fs.writeFileSync('./gastos.json', '{}');
}

function salvarGastos() {
  fs.writeFileSync('./gastos.json', JSON.stringify(gastos, null, 2));
}

// ===== SISTEMA EMBED =====
const embedSessions = {};

function gerarEmbedCustom(data) {
  return new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(data.title || null)
    .setDescription(data.description || "Sem descrição")
    .setImage(data.image || null)
    .setThumbnail(data.thumb || null)
    .setAuthor(
      data.author
        ? { name: data.author, iconURL: data.authorIcon || null }
        : null
    );
}

// ===== API =====
app.get('/perfil/:id', async (req, res) => {
  const id = req.params.id;

  if (!client.isReady()) {
    return setTimeout(() => res.redirect(`/perfil/${id}`), 2000);
  }

  try {
    const user = await client.users.fetch(id);
    const total = gastos[id] || 0;

    let vip = "Sem cargo";
    if (total >= 1000) vip = "Diamante";
    else if (total >= 500) vip = "Ouro";
    else if (total >= 300) vip = "Prata";
    else if (total >= 100) vip = "Bronze";

    const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);
    const posicao = ranking.findIndex(u => u[0] === id) + 1;

    res.json({
      nome: user.username,
      avatar: user.displayAvatarURL({ dynamic: true, size: 512 }),
      total,
      vip,
      posicao: posicao || null
    });

  } catch {
    res.json({ erro: true });
  }
});

app.listen(3000, () => {
  console.log('Web server ligado');
});

// ===== BOT ONLINE =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {

  try {

    // ===== SISTEMA EMBED (FUNCIONA JUNTO COM TUDO) =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {

      embedSessions[interaction.user.id] = { lista: [{}], atual: 0 };

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('Painel de Embeds')
            .setDescription('Gerencie seus embeds abaixo')
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
            new ButtonBuilder().setCustomId('del_embed').setLabel('Deletar').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    // ===== OUTROS COMANDOS (SEU CÓDIGO INTACTO) =====
    if (!interaction.isChatInputCommand()) return;

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

    if (interaction.commandName === 'avaliar') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
        .setThumbnail('https://cdn.discordapp.com/attachments/1411723762260508702/1473016671240323103/Design_sem_nome.png')
        .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
        .setDescription(`**•** Avaliação: ${texto}\n**•** Total: ${db.total}\n**•** Pedido: ${db.pedidos}`);

      const canal = client.channels.cache.get(CANAL_AVALIACOES);
      if (canal) canal.send({ embeds: [embed] });

      return interaction.editReply('Avaliação enviada.');
    }

  } catch (err) {
    console.error(err);
  }

});

// ===== INTERAÇÕES DO EMBED =====
client.on('interactionCreate', async (interaction) => {

  try {

    const s = embedSessions[interaction.user.id];
    if (!s) return;

    // SELECT
    if (interaction.isStringSelectMenu()) {
      s.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [gerarEmbedCustom(s.lista[s.atual])]
      });
    }

    // BOTÕES
    if (interaction.isButton()) {

      if (interaction.customId === 'add_embed') {
        s.lista.push({});
      }

      if (interaction.customId === 'del_embed') {
        s.lista.splice(s.atual, 1);
        if (s.lista.length === 0) s.lista.push({});
        s.atual = 0;
      }

      if (interaction.customId === 'enviar') {
        return interaction.channel.send({
          embeds: s.lista.map(e => gerarEmbedCustom(e))
        });
      }

      return interaction.update({
        embeds: [gerarEmbedCustom(s.lista[s.atual])]
      });
    }

  } catch (err) {
    console.error(err);
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);
