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

    // ===== SLASH =====
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
          .setDescription(`• **Avaliação:** ${texto}
• **Total de avaliações:** ${db.total}
• **Pedido:** ${db.pedidos}

Esta avaliação foi registrada de forma **anônima**, devido ao sistema de banimento do **FLEE THE FACILITY**, prezamos pelo máximo de segurança possível dos nossos **clientes!**`);

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }
    }

    // ===== SESSÃO =====
    const session = embedSessions[interaction.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual];
    if (!atual) return;

    // ===== SELECT =====
    if (interaction.isStringSelectMenu()) {
      session.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      // ===== BOTÃO MSG =====
      if (id.startsWith('msg_')) {
        const index = Number(id.split('_')[1]);
        const btn = session.buttons[index];
        if (!btn) return;

        await interaction.deferUpdate();

        return interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor('#2b2d31')
              .setDescription(btn.valor)
          ],
          ephemeral: true
        });
      }

      // ===== ADD BOTÃO
      if (id === 'add_button') {
        const modal = new ModalBuilder()
          .setCustomId('criar_botao')
          .setTitle('Botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Nome').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Mensagem ou link').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cor').setLabel('Cor (azul, verde, cinza, vermelho)').setStyle(TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

      // ===== AUTOR (FIX)
      if (id === 'autor') {
        const modal = new ModalBuilder()
          .setCustomId('autor_full')
          .setTitle('Autor');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('nome')
              .setLabel('Nome')
              .setStyle(TextInputStyle.Short)
              .setValue(atual.author?.nome || '')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('icon')
              .setLabel('URL da imagem')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setValue(atual.author?.icon || '')
          )
        );

        return interaction.showModal(modal);
      }

      // ===== ENVIAR (FIX)
      if (id === 'enviar') {
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
              new ButtonBuilder()
                .setLabel(btn.label)
                .setStyle(btn.style || ButtonStyle.Primary)
                .setCustomId(`msg_${i}`)
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

      // ===== EDITAR CAMPOS
      if (['titulo','desc','imagem','thumb'].includes(id)) {

        let valorAtual = '';
        if (id === 'titulo') valorAtual = atual.title || '';
        if (id === 'desc') valorAtual = atual.description || '';
        if (id === 'imagem') valorAtual = atual.image || '';
        if (id === 'thumb') valorAtual = atual.thumbnail || '';

        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle('Editar');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel('Digite (opcional)')
              .setRequired(false)
              .setStyle(id === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setValue(valorAtual)
          )
        );

        return interaction.showModal(modal);
      }

      if (id === 'add_embed') {
        session.embeds.push({});
        session.atual = session.embeds.length - 1;

        return interaction.update({
          embeds: [montarEmbed(session.embeds[session.atual])],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (id === 'delete') {
        session.embeds.splice(session.atual, 1);
        if (session.embeds.length === 0) session.embeds.push({});
        session.atual = 0;

        return interaction.update({
          embeds: [montarEmbed(session.embeds[session.atual])],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (id === 'edit') {
        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarEditor()
        });
      }

      if (id === 'voltar') {
        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarMenu(interaction.user.id)
        });
      }
    }

    if (interaction.isModalSubmit()) {

      // ===== AUTOR FIX FINAL
      if (interaction.customId === 'autor_full') {
        const nome = interaction.fields.getTextInputValue('nome');
        const icon = interaction.fields.getTextInputValue('icon');

        if (!nome && !icon) {
          delete atual.author;
        } else {
          atual.author = {
            nome: nome || '⠀',
            icon: icon || undefined
          };
        }

        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarEditor()
        });
      }

      if (interaction.customId === 'criar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');
        const cor = interaction.fields.getTextInputValue('cor')?.toLowerCase();

        session.buttons.push({
          label,
          valor,
          style: styleMap[cor] || ButtonStyle.Primary
        });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }

      // ===== CAMPOS FIX
      if (['titulo','desc','imagem','thumb'].includes(interaction.customId)) {
        const valor = interaction.fields.getTextInputValue('input');

        if (interaction.customId === 'titulo') atual.title = valor || null;

        if (interaction.customId === 'desc') atual.description = valor || '⠀';

        if (interaction.customId === 'imagem') {
          if (!valor) delete atual.image;
          else atual.image = valor;
        }

        if (interaction.customId === 'thumb') {
          if (!valor) delete atual.thumbnail;
          else atual.thumbnail = valor;
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

  if (data.image) embed.setImage(data.image);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  if (data.author) {
    embed.setAuthor({
      name: data.author.nome || '⠀',
      iconURL: data.author.icon || undefined
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
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('delete').setLabel('Deletar').setStyle(ButtonStyle.Danger),
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
      new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(ButtonStyle.Primary)
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
