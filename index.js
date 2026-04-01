// 🔥 NÃO TRATADOS
const { REST, Routes } = require('discord.js');
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// ===== BANCO =====
let db = { total: 427, pedidos: 458, embedsSalvos: {} };
if (fs.existsSync('./db.json')) {
  db = JSON.parse(fs.readFileSync('./db.json'));
}
const salvar = () => fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));

// ===== SESSÕES =====
const embedSessions = {};

// ===== READY =====
client.once('ready', async () => {
  console.log(`Logado como ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: [
          {
            name: 'embed',
            description: 'Painel de embed'
          },
          {
            name: 'avaliar',
            description: 'Enviar avaliação',
            options: [
              {
                name: 'texto',
                type: 3,
                description: 'Digite a avaliação',
                required: true
              }
            ]
          }
        ]
      }
    );

    console.log('✅ Comandos registrados!');
  } catch (err) {
    console.error(err);
  }
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (i) => {
  try {

    // 🔥 BOTÃO GLOBAL
    if (i.isButton() && i.customId.startsWith('msg_')) {
      return i.reply({ content: i.customId.slice(4), ephemeral: true });
    }

    // 🔥 EDITAR DEPOIS
    if (i.isButton() && i.customId.startsWith('editarEmbed_')) {
      const id = i.customId.split('_')[1];
      if (!db.embedsSalvos[id]) return;

      embedSessions[i.user.id] = JSON.parse(JSON.stringify(db.embedsSalvos[id]));

      return i.reply({
        content: 'Embed carregado!',
        embeds: [build(embedSessions[i.user.id].embeds[0])],
        components: menu(i.user.id),
        ephemeral: true
      });
    }

    const isAdmin = i.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // ===== COMANDOS =====
    if (i.isChatInputCommand()) {

      if (i.commandName === 'embed') {
        embedSessions[i.user.id] = {
          embeds: [{ title: 'Novo Embed', description: 'Edite aqui' }],
          atual: 0,
          buttons: []
        };

        return i.reply({
          embeds: [build(embedSessions[i.user.id].embeds[0])],
          components: menu(i.user.id),
          ephemeral: true
        });
      }

      if (i.commandName === 'avaliar') {
        if (!isAdmin) return i.reply({ content: 'Só admin.', ephemeral: true });

        const texto = i.options.getString('texto');

        db.total++;
        db.pedidos++;
        salvar();

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('**Avaliação Recebida! 🖤**')
          .setThumbnail('https://cdn.discordapp.com/attachments/1411723762260508702/1473016671240323103/Design_sem_nome.png')
          .setDescription(`**• Avaliação:** ${texto}
**• Total de avaliações:** ${db.total}
**• Pedido:** ${db.pedidos}

Esta avaliação foi registrada de forma **anônima**, devido ao sistema de banimento do **FLEE THE FACILITY**, prezamos pelo máximo de segurança possível dos nossos **clientes!**`)
          .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png');

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return i.reply({ content: 'Avaliação enviada!', ephemeral: true });
      }
    }

    const s = embedSessions[i.user.id];
    if (!s) return;

    let atual = s.embeds[s.atual];

    // ===== SELECT =====
    if (i.isStringSelectMenu()) {
      s.atual = Number(i.values[0]);
      return i.update({ embeds: [build(s.embeds[s.atual])], components: menu(i.user.id) });
    }

    // ===== BOTÕES =====
    if (i.isButton()) {
      const id = i.customId;

      if (id === 'add_embed') {
        s.embeds.push({});
        s.atual = s.embeds.length - 1;
      }

      if (id === 'edit') {
        return i.update({ embeds: [build(atual)], components: editor() });
      }

      if (id === 'voltar') {
        return i.update({ embeds: [build(atual)], components: menu(i.user.id) });
      }

      if (id === 'salvar') {
        const idSalvo = Date.now().toString();
        db.embedsSalvos[idSalvo] = s;
        salvar();
        return i.reply({ content: `Salvo ID: ${idSalvo}`, ephemeral: true });
      }

      if (id === 'add_button') {
        return modalBotao(i, 'criar');
      }

      if (id === 'gerenciar') {
        if (!s.buttons.length) return i.reply({ content: 'Sem botões', ephemeral: true });

        const rows = s.buttons.map((b, index) =>
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`edit_btn_${index}`).setLabel(`Editar ${b.label}`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`del_btn_${index}`).setLabel('Excluir').setStyle(ButtonStyle.Danger)
          )
        );

        return i.update({ components: rows });
      }

      if (id.startsWith('edit_btn_')) {
        s.editando = Number(id.split('_')[2]);
        return modalBotao(i, 'editar');
      }

      if (id.startsWith('del_btn_')) {
        const index = Number(id.split('_')[2]);
        s.buttons.splice(index, 1);
      }

      if (id === 'enviar') {
        const idSalvo = Date.now().toString();
        db.embedsSalvos[idSalvo] = s;
        salvar();

        const rows = [];
        let row = new ActionRowBuilder();

        s.buttons.forEach((b, i) => {
          if (i % 5 === 0 && i !== 0) {
            rows.push(row);
            row = new ActionRowBuilder();
          }

          const styleMap = {
            azul: ButtonStyle.Primary,
            verde: ButtonStyle.Success,
            cinza: ButtonStyle.Secondary,
            preto: ButtonStyle.Secondary
          };

          if (b.valor.startsWith('http')) {
            row.addComponents(new ButtonBuilder().setLabel(b.label).setStyle(ButtonStyle.Link).setURL(b.valor));
          } else {
            row.addComponents(new ButtonBuilder().setLabel(b.label).setStyle(styleMap[b.cor] || ButtonStyle.Primary).setCustomId(`msg_${b.valor}`));
          }
        });

        if (row.components.length) rows.push(row);

        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`editarEmbed_${idSalvo}`).setLabel('Editar depois').setStyle(ButtonStyle.Secondary)
          )
        );

        await i.channel.send({
          embeds: s.embeds.map(build),
          components: rows
        });

        return i.reply({ content: 'Enviado!', ephemeral: true });
      }

      // 🔥 CAMPOS
      if (['titulo','desc','imagem','thumb'].includes(id)) {
        return modalCampo(i, id);
      }

      if (id === 'autor') {
        return modalAutor(i);
      }

      return i.update({ embeds: [build(atual)], components: menu(i.user.id) });
    }

    // ===== MODAL =====
    if (i.isModalSubmit()) {

      if (i.customId === 'criar' || i.customId === 'editar') {
        const label = i.fields.getTextInputValue('nome');
        const valor = i.fields.getTextInputValue('valor');
        const cor = i.fields.getTextInputValue('cor');

        const data = { label, valor, cor };

        if (i.customId === 'criar') s.buttons.push(data);
        else s.buttons[s.editando] = data;

        return i.reply({ content: 'Botão salvo!', ephemeral: true });
      }

      if (i.customId === 'autor_modal') {
        atual.author = {
          nome: i.fields.getTextInputValue('nome'),
          icon: i.fields.getTextInputValue('icon')
        };

        return i.update({
          embeds: [build(atual)],
          components: editor()
        });
      }

      const val = i.fields.getTextInputValue('input');

      if (i.customId === 'titulo') atual.title = val;
      if (i.customId === 'desc') atual.description = val;
      if (i.customId === 'imagem') atual.image = val;
      if (i.customId === 'thumb') atual.thumbnail = val;

      return i.update({ embeds: [build(atual)], components: editor() });
    }

  } catch (err) {
    console.error(err);
  }
});

// ===== FUNÇÕES =====
function build(e) {
  const embed = new EmbedBuilder().setColor('#2b2d31');

  if (e.title) embed.setTitle(e.title);
  if (e.description) embed.setDescription(e.description || '‎');
  if (e.image) embed.setImage(e.image);
  if (e.thumbnail) embed.setThumbnail(e.thumbnail);

  if (e.author) {
    embed.setAuthor({
      name: e.author.nome || '‎',
      iconURL: e.author.icon || undefined
    });
  }

  return embed;
}

function menu(id) {
  const s = embedSessions[id];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .addOptions(s.embeds.map((_, i) => ({
          label: `Embed ${i+1}`,
          value: `${i}`
        })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('add_button').setLabel('Botão').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('gerenciar').setLabel('Gerenciar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('salvar').setLabel('Salvar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Success)
    )
  ];
}

function editor() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('imagem').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumb').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('autor').setLabel('Autor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(ButtonStyle.Primary)
    )
  ];
}

function modalCampo(i, id) {
  const modal = new ModalBuilder().setCustomId(id).setTitle('Editar');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('input').setLabel('Digite').setStyle(TextInputStyle.Paragraph)
    )
  );

  return i.showModal(modal);
}

function modalAutor(i) {
  const modal = new ModalBuilder()
    .setCustomId('autor_modal')
    .setTitle('Autor');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nome').setLabel('Nome do autor').setStyle(TextInputStyle.Short)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('icon').setLabel('URL do ícone').setStyle(TextInputStyle.Short).setRequired(false)
    )
  );

  return i.showModal(modal);
}

function modalBotao(i, tipo) {
  const modal = new ModalBuilder().setCustomId(tipo).setTitle('Botão');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nome').setLabel('Nome').setStyle(TextInputStyle.Short)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('valor').setLabel('Mensagem ou link').setStyle(TextInputStyle.Paragraph)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('cor').setLabel('Cor (azul, verde, cinza, preto)').setStyle(TextInputStyle.Short).setRequired(false)
    )
  );

  return i.showModal(modal);
}

// WEB
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot online'));
app.listen(PORT);

client.login(TOKEN);
