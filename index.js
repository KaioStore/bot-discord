process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Promise rejeitada:', err);
});

const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
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

// ===== API =====
// ===== API =====
app.get('/perfil/:id', async (req, res) => {
  const id = req.params.id;

  // 🔥 ADICIONADO (ESPERA O BOT LIGAR)
  if (!client.isReady()) {
    return setTimeout(() => {
      res.redirect(`/perfil/${req.params.id}`);
    }, 2000);
  }

  if (!client.isReady()) {
    return res.json({ erro: true });
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


// 🔥🔥🔥 SUA ROTA RANKING COM ADIÇÃO
app.get('/ranking', async (req, res) => {

  // 🔥 ADICIONADO (ESPERA O BOT LIGAR)
  if (!client.isReady()) {
    return setTimeout(() => {
      res.redirect('/ranking');
    }, 2000);
  }

  try {
    const ranking = Object.entries(gastos)
      .sort((a, b) => b[1] - a[1]);

    const lista = [];

    for (let i = 0; i < ranking.length; i++) {
      const userId = ranking[i][0];
      const total = ranking[i][1];

      let nome = "Usuário";

      try {
        const user = await client.users.fetch(userId);
        nome = user.username;
      } catch {}

      lista.push({
        id: userId,
        nome,
        total
      });
    }

    res.json(lista);

  } catch (err) {
    res.json([]);
  }
});

// 🔥🔥🔥 ADICIONADO (NÃO REMOVIDO NADA)
app.get('/ranking', async (req, res) => {
  try {
    const ranking = Object.entries(gastos)
      .sort((a, b) => b[1] - a[1]);

    const lista = [];

    for (let i = 0; i < ranking.length; i++) {
      const userId = ranking[i][0];
      const total = ranking[i][1];

      let nome = "Usuário";

      try {
        const user = await client.users.fetch(userId);
        nome = user.username;
      } catch {}

      lista.push({
        id: userId,
        nome,
        total
      });
    }

    res.json(lista);

  } catch (err) {
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

// (SEU CÓDIGO TODO FICA IGUAL ATÉ A PARTE DOS COMANDOS)

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  try {

    // ===== SALDO (ADICIONADO) =====
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

    // ===== EMBED (ADICIONADO) =====
    if (interaction.commandName === 'embed') {

      const embed = new EmbedBuilder()
        .setTitle('Seu embed')
        .setDescription('Use este comando como base e depois evoluímos 😉')
        .setColor('#2b2d31');

      return interaction.reply({ embeds: [embed] });
    }

    // ===== AVALIAR =====
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

    // ===== REMOVER GASTO =====
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

    // ===== RANK =====
    if (interaction.commandName === 'rank') {

      await interaction.deferReply();

      const ranking = Object.entries(gastos).sort((a, b) => b[1] - a[1]);

      const porPagina = 10;
      let pagina = 0;

      async function gerarEmbed(p) {

        const totalPaginas = Math.max(1, Math.ceil(ranking.length / porPagina));
        const inicio = p * porPagina;
        const dados = ranking.slice(inicio, inicio + porPagina);

        let texto = '';

        for (let i = 0; i < dados.length; i++) {

          const userId = dados[i][0];
          const valor = dados[i][1];
          const pos = inicio + i + 1;

          let medalha = `${pos}.`;
          if (pos === 1) medalha = '🥇';
          else if (pos === 2) medalha = '🥈';
          else if (pos === 3) medalha = '🥉';

          let username = 'Usuário';

          try {
            const user = await client.users.fetch(userId);
            username = user.username;
          } catch {}

          const link = `https://kaio-rank.vercel.app/?id=${userId}`;

          texto += `${medalha} [${username}](${link})\n💰 Total: R$${valor}\n\n`;
        }

        texto += `> Continue comprando para subir no ranking e ganhar benefícios!`;

        return new EmbedBuilder()
          .setTitle('Top Clientes')
          .setColor('#2b2d31')
          .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
          .setDescription(texto)
          .setFooter({ text: `Página ${p + 1}/${totalPaginas}` });
      }

      const row = {
        type: 1,
        components: [
          { type: 2, style: 2, label: '‹ Anterior', custom_id: 'anterior' },
          { type: 2, style: 2, label: 'Próximo ›', custom_id: 'proximo' }
        ]
      };

      const msg = await interaction.editReply({
        embeds: [await gerarEmbed(pagina)],
        components: [row],
        fetchReply: true
      });

      const collector = msg.createMessageComponentCollector({ time: 600000 });

      collector.on('collect', async i => {

        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'Só você pode usar.', ephemeral: true });
        }

        const totalPaginas = Math.ceil(ranking.length / porPagina);

        if (i.customId === 'anterior' && pagina > 0) pagina--;
        if (i.customId === 'proximo' && pagina < totalPaginas - 1) pagina++;

        await i.update({
          embeds: [await gerarEmbed(pagina)],
          components: [row]
        });
      });
    }

  } catch (err) {
    console.error(err);

    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: 'Erro ao executar.', ephemeral: true });
    } else {
      interaction.reply({ content: 'Erro ao executar.', ephemeral: true });
    }
  }

});

client.login(TOKEN);
setInterval(() => {}, 1000);

// ===== EMBED SYSTEM INSANO++ (ADICIONADO SEM REMOVER NADA) =====

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const embedSessionsADV = {};
const embedMessagesADV = {};

function gerarEmbedADV(data) {
  return new EmbedBuilder()
    .setTitle(data.title || null)
    .setDescription(data.description || null)
    .setColor(data.color || '#2b2d31')
    .setThumbnail(data.thumbnail || null)
    .setImage(data.image || null)
    .setFooter(data.footer ? { text: data.footer } : null)
    .setAuthor(data.author ? { name: data.author } : null);
}

function painelADV() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('adv_add_embed').setLabel('+ Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adv_title').setLabel('Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adv_desc').setLabel('Descrição').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adv_color').setLabel('Cor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('adv_image').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adv_thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adv_footer').setLabel('Rodapé').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adv_author').setLabel('Autor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('adv_button').setLabel('+ Botão').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adv_send').setLabel('Enviar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adv_edit').setLabel('Editar Msg').setStyle(ButtonStyle.Secondary)
    )
  ];
}

// ===== NOVA INTERAÇÃO (NÃO QUEBRA A SUA) =====
client.on('interactionCreate', async (interaction) => {

  // ===== NOVO /embed (SOBRESCREVE O SIMPLES) =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {

    embedSessionsADV[interaction.user.id] = {
      atual: 0,
      lista: [{}]
    };

    return interaction.reply({
      embeds: [gerarEmbedADV({})],
      components: painelADV(),
      ephemeral: true
    });
  }

  // ===== BOTÕES =====
  if (interaction.isButton()) {

    const session = embedSessionsADV[interaction.user.id];
    if (!session) return;

    const atual = session.lista[session.atual];

    const modal = (id, label) =>
      new ModalBuilder()
        .setCustomId(id)
        .setTitle(label)
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel(label)
              .setStyle(TextInputStyle.Short)
          )
        );

    if (interaction.customId === 'adv_add_embed') session.lista.push({});

    if (interaction.customId === 'adv_title') return interaction.showModal(modal('adv_title_modal', 'Título'));
    if (interaction.customId === 'adv_desc') return interaction.showModal(modal('adv_desc_modal', 'Descrição'));
    if (interaction.customId === 'adv_color') return interaction.showModal(modal('adv_color_modal', 'Cor HEX'));
    if (interaction.customId === 'adv_image') return interaction.showModal(modal('adv_image_modal', 'URL Imagem'));
    if (interaction.customId === 'adv_thumb') return interaction.showModal(modal('adv_thumb_modal', 'Thumbnail'));
    if (interaction.customId === 'adv_footer') return interaction.showModal(modal('adv_footer_modal', 'Rodapé'));
    if (interaction.customId === 'adv_author') return interaction.showModal(modal('adv_author_modal', 'Autor'));

    if (interaction.customId === 'adv_button') {
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId('adv_btn_modal')
          .setTitle('Criar Botão')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('label').setLabel('Texto').setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('url').setLabel('Link').setStyle(TextInputStyle.Short)
            )
          )
      );
    }

    if (interaction.customId === 'adv_send') {
      const msg = await interaction.channel.send({
        embeds: session.lista.map(e => gerarEmbedADV(e))
      });

      embedMessagesADV[interaction.user.id] = msg;
    }

    if (interaction.customId === 'adv_edit') {
      const msg = embedMessagesADV[interaction.user.id];
      if (msg) {
        await msg.edit({
          embeds: session.lista.map(e => gerarEmbedADV(e))
        });
      }
    }

    return interaction.update({
      embeds: [gerarEmbedADV(atual)],
      components: painelADV()
    });
  }

  // ===== MODALS =====
  if (interaction.isModalSubmit()) {

    const session = embedSessionsADV[interaction.user.id];
    if (!session) return;

    const atual = session.lista[session.atual];

    if (interaction.customId === 'adv_btn_modal') {
      const label = interaction.fields.getTextInputValue('label');
      const url = interaction.fields.getTextInputValue('url');

      if (!atual.buttons) atual.buttons = [];
      atual.buttons.push({ label, url });

      return interaction.reply({ content: 'Botão criado!', ephemeral: true });
    }

    const value = interaction.fields.getTextInputValue('input');

    const map = {
      adv_title_modal: 'title',
      adv_desc_modal: 'description',
      adv_color_modal: 'color',
      adv_image_modal: 'image',
      adv_thumb_modal: 'thumbnail',
      adv_footer_modal: 'footer',
      adv_author_modal: 'author'
    };

    atual[map[interaction.customId]] = value;

    return interaction.update({
      embeds: [gerarEmbedADV(atual)],
      components: painelADV()
    });
  }

});
