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

// ===== SISTEMA EMBED (NOVO) =====
const embedSessions = {};
const embedMessages = {};

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

app.get('/ranking', async (req, res) => {
  try {
    const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);
    const lista = [];

    for (let i = 0; i < ranking.length; i++) {
      const userId = ranking[i][0];
      const total = ranking[i][1];

      let nome = "Usuário";

      try {
        const user = await client.users.fetch(userId);
        nome = user.username;
      } catch {}

      lista.push({ id: userId, nome, total });
    }

    res.json(lista);

  } catch {
    res.json([]);
  }
});

app.listen(3000, () => {
  console.log('Web server ligado');
});

// ===== BOT ONLINE =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== GERAR EMBED =====
function gerarEmbed(data) {
  return new EmbedBuilder()
    .setTitle(data.title || null)
    .setDescription(data.description || null)
    .setColor(data.color || '#2b2d31')
    .setThumbnail(data.thumbnail || null)
    .setImage(data.image || null)
    .setFooter(data.footer ? { text: data.footer } : null)
    .setAuthor(data.author ? { name: data.author } : null);
}

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {

  // ===== SLASH =====
  if (interaction.isChatInputCommand()) {

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

    // ===== EMBED AVANÇADO =====
    if (interaction.commandName === 'embed') {

      embedSessions[interaction.user.id] = {
        atual: 0,
        lista: [{}]
      };

      return interaction.reply({
        embeds: [gerarEmbed({})],
        components: [painel()],
        ephemeral: true
      });
    }

    // ===== AVALIAR (SEU ORIGINAL) =====
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

    // ===== GASTAR =====
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
  }

  // ===== BOTÕES / MODAIS / SELECT =====
  if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {

    const session = embedSessions[interaction.user.id];
    if (!session) return;

    const atual = session.lista[session.atual];

    // BOTÕES
    if (interaction.isButton()) {

      if (interaction.customId === 'add') {
        session.lista.push({});
        session.atual = session.lista.length - 1;
      }

      if (interaction.customId === 'send') {
        const msg = await interaction.channel.send({
          embeds: session.lista.map(e => gerarEmbed(e))
        });
        embedMessages[interaction.user.id] = msg;
      }

      if (interaction.customId === 'editmsg') {
        const msg = embedMessages[interaction.user.id];
        if (msg) {
          await msg.edit({
            embeds: session.lista.map(e => gerarEmbed(e))
          });
        }
      }

      if (interaction.customId === 'export') {
        return interaction.reply({
          content: '```json\n' + JSON.stringify(atual, null, 2) + '\n```',
          ephemeral: true
        });
      }

      if (interaction.customId === 'import') {
        return interaction.showModal(modal('import', 'Colar JSON', true));
      }

      const map = {
        title: 'Título',
        desc: 'Descrição',
        color: 'Cor HEX',
        image: 'Imagem URL',
        thumb: 'Thumbnail URL',
        footer: 'Rodapé',
        author: 'Autor'
      };

      if (map[interaction.customId]) {
        return interaction.showModal(modal(interaction.customId, map[interaction.customId]));
      }

      return interaction.update({
        embeds: [gerarEmbed(atual)],
        components: [painel()]
      });
    }

    // MODAL
    if (interaction.isModalSubmit()) {

      const val = interaction.fields.getTextInputValue('input');

      const map = {
        title: 'title',
        desc: 'description',
        color: 'color',
        image: 'image',
        thumb: 'thumbnail',
        footer: 'footer',
        author: 'author'
      };

      if (interaction.customId === 'import') {
        try {
          session.lista[session.atual] = JSON.parse(val);
        } catch {
          return interaction.reply({ content: 'JSON inválido', ephemeral: true });
        }
      } else {
        atual[map[interaction.customId]] = val;
      }

      return interaction.update({
        embeds: [gerarEmbed(session.lista[session.atual])],
        components: [painel()]
      });
    }
  }

});

// ===== UI =====
function painel() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add').setLabel('+ Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('title').setLabel('Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('color').setLabel('Cor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('image').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('footer').setLabel('Rodapé').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('author').setLabel('Autor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('send').setLabel('Enviar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('editmsg').setLabel('Editar Msg').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('import').setLabel('Importar JSON').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('export').setLabel('Exportar JSON').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function modal(id, label, big = false) {
  return new ModalBuilder()
    .setCustomId(id)
    .setTitle(label)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('input')
          .setLabel(label)
          .setStyle(big ? TextInputStyle.Paragraph : TextInputStyle.Short)
      )
    );
}

client.login(TOKEN);
setInterval(() => {}, 1000);
