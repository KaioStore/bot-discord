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

// ===== CORES DOS BOTÕES (ARRUMADO) =====
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

// ===== INTERAÇÕES =====
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
              .setDescription('Use os botões abaixo para editar')
          ],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

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

      if (interaction.commandName === 'gastar') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        gastos[user.id] = (gastos[user.id] || 0) + valor;
        salvar();

        return interaction.reply({ content: `Adicionado R$${valor} para ${user.username}`, ephemeral: true });
      }

      if (interaction.commandName === 'removergasto') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', ephemeral: true });

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        gastos[user.id] = (gastos[user.id] || 0) - valor;
        if (gastos[user.id] < 0) gastos[user.id] = 0;
        salvar();

        return interaction.reply({ content: `Removido R$${valor} de ${user.username}`, ephemeral: true });
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
          .setDescription(`**•** Avaliação: ${texto}
**•** Total: ${db.total}
**•** Pedido: ${db.pedidos}`);

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }

      if (interaction.commandName === 'rank') {
        const rankingArray = Object.entries(gastos).sort(([,a],[,b]) => b - a);

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('🏆 Top Clientes')
          .setDescription(
            rankingArray.map(([id, total], i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
              return `${medal} [<@${id}>](${SITE}/user/${id})\n💰 Total: R$${total}`;
            }).join('\n\n')
          );

        return interaction.reply({ embeds: [embed] });
      }
    }

    const session = embedSessions[interaction.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual];
    if (!atual) return;

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

      // ===== EDITAR CAMPOS (CORRIGIDO BUG) =====
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
              .setLabel('Digite')
              .setStyle(id === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setValue(valorAtual)
          )
        );

        return interaction.showModal(modal);
      }

      // ===== AUTOR COMPLETO =====
      if (id === 'autor') {
        const modal = new ModalBuilder()
          .setCustomId('autor_full')
          .setTitle('Editar Autor');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('nome').setLabel('Nome').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('icon').setLabel('Imagem URL').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('url').setLabel('URL clicável').setStyle(TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

      // ===== ADICIONAR BOTÃO =====
      if (id === 'add_button') {
        const modal = new ModalBuilder()
          .setCustomId('criar_botao')
          .setTitle('Adicionar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Nome').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Link ou mensagem').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cor').setLabel('Cor (azul, verde, cinza, vermelho)').setStyle(TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

      if (id === 'add_embed') {
        session.embeds.push({});
        session.atual = session.embeds.length - 1;
      }

      if (id === 'delete') {
        session.embeds.splice(session.atual, 1);
        if (session.embeds.length === 0) session.embeds.push({});
        session.atual = 0;
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

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    // MODAL
    if (interaction.isModalSubmit()) {

      if (interaction.customId === 'criar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');
        const cor = interaction.fields.getTextInputValue('cor')?.toLowerCase() || 'azul';

        session.buttons.push({
          label,
          valor,
          style: styleMap[cor] || ButtonStyle.Primary
        });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }

      const valor = interaction.fields.getTextInputValue('input') || '⠀';

      if (interaction.customId === 'titulo') atual.title = valor;
      if (interaction.customId === 'desc') atual.description = valor;
      if (interaction.customId === 'imagem') atual.image = valor;
      if (interaction.customId === 'thumb') atual.thumbnail = valor;

      if (interaction.customId === 'autor_full') {
        atual.author = {
          nome: interaction.fields.getTextInputValue('nome'),
          icon: interaction.fields.getTextInputValue('icon'),
          url: interaction.fields.getTextInputValue('url')
        };

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
      iconURL: data.author.icon || undefined,
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
