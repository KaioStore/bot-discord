// 🔥 NÃO TRATADOS
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

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== CORES =====
const styleMap = {
  azul: ButtonStyle.Primary,
  verde: ButtonStyle.Success,
  cinza: ButtonStyle.Secondary,
  vermelho: ButtonStyle.Danger
};

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
              .setTitle('Abrir painel embed')
              .setDescription('Use os botões abaixo')
          ],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

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
          .setDescription(`**•** **Avaliação:** ${texto}
**•** **Total de avaliações:** ${db.total}
**•** **Pedido:** ${db.pedidos}

Esta avaliação foi registrada de forma **anônima**, devido ao sistema de banimento do **FLEE THE FACILITY**, prezamos pelo máximo de segurança possível dos nossos **clientes!**`);

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }
    }

    const session = embedSessions[interaction.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual];
    if (!atual) return;

    if (interaction.isStringSelectMenu()) {
      session.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (['titulo','desc','imagem','thumb'].includes(id)) {

        let valorAtual = '';
        if (id === 'titulo') valorAtual = atual.title || '';
        if (id === 'desc') valorAtual = atual.description || '';
        if (id === 'imagem') valorAtual = atual.image?.url || '';
        if (id === 'thumb') valorAtual = atual.thumbnail?.url || '';

        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle('Editar');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel(
                id === 'imagem'
                  ? 'URL da imagem'
                  : id === 'thumb'
                  ? 'URL do thumbnail'
                  : 'Digite (opcional)'
              )
              .setRequired(false)
              .setStyle(id === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setValue(valorAtual)
          )
        );

        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit()) {

      if (['titulo','desc','imagem','thumb'].includes(interaction.customId)) {
        const valor = interaction.fields.getTextInputValue('input')?.trim();

        if (interaction.customId === 'titulo') atual.title = valor || null;
        if (interaction.customId === 'desc') atual.description = valor || '⠀';

        if (interaction.customId === 'imagem') {
          if (!valor) delete atual.image;
          else atual.image = { url: valor };
        }

        if (interaction.customId === 'thumb') {
          if (!valor) delete atual.thumbnail;
          else atual.thumbnail = { url: valor };
        }

        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarEditor()
        });
      }
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

  if (data.image?.url) embed.setImage(data.image.url);
  if (data.thumbnail?.url) embed.setThumbnail(data.thumbnail.url);

  if (data.author) {
    embed.setAuthor({
      name: data.author.nome || '⠀',
      iconURL: data.author.icon || undefined
    });
  }

  return embed;
}

// ✅ AGORA FORA (CORRETO)
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
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Secondary)
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
    )
  ];
}

// ===== WEB =====
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot online');
});

app.listen(PORT, () => {
  console.log('Servidor rodando');
});

// ===== LOGIN =====
client.login(TOKEN);
