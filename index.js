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
  TextInputStyle,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== BANCO =====
let db;

try {
  if (fs.existsSync('./db.json')) {
    db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
  } else {
    db = { total: 427, pedidos: 458 };
  }
} catch {
  db = { total: 427, pedidos: 458 };
}

function salvar() {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

// ===== EMBED SYSTEM =====
const embedSessions = {};

// ===== READY =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    // 🔥 BOTÃO CORRIGIDO (SEM "Mensagem")
    if (interaction.isButton() && interaction.customId.startsWith('msg_')) {
      const session = embedSessions[interaction.user.id];
      if (!session) return interaction.reply({ content: 'Sessão perdida.', ephemeral: true });

      const index = Number(interaction.customId.split('_')[1]);
      const btn = session.buttons[index];

      if (!btn) return interaction.reply({ content: 'Botão inválido.', ephemeral: true });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#2b2d31')
            .setDescription(btn.valor)
        ],
        ephemeral: true
      });
    }

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'embed') {

        if (!embedSessions[interaction.user.id]) {
          embedSessions[interaction.user.id] = {
            embeds: [{
              title: 'Novo Embed',
              description: 'Lembre-se que seu Embed não pode ser vazio!'
            }],
            atual: 0,
            buttons: []
          };
        }

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#2b2d31')
              .setTitle('Painel de Embed')
              .setDescription('Use os botões abaixo')
          ],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }

      if (interaction.commandName === 'avaliar') {
        if (!isAdmin) {
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
          .setDescription(`**• Avaliação:** ${texto}
**• Total de avaliações:** ${db.total}
**• Pedido:** ${db.pedidos}

Esta avaliação foi registrada de forma **anônima**, devido ao sistema de banimento do **FLEE THE FACILITY**, prezamos pelo máximo de segurança possível dos nossos **clientes!**`)
          .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png');

        const canal = client.channels.cache.get(CANAL_AVALIACOES);
        if (canal) canal.send({ embeds: [embed] });

        return interaction.editReply('Avaliação enviada.');
      }
    }

    const session = embedSessions[interaction.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual];

  if (interaction.isStringSelectMenu()) {

  if (interaction.customId === 'select') {
    session.atual = Number(interaction.values[0]);

    return interaction.update({
      embeds: [montarEmbed(session.embeds[session.atual])],
      components: gerarMenu(interaction.user.id)
    });
  }

  if (interaction.customId === 'select_button') {
    const index = Number(interaction.values[0]);
    session.botaoAtual = index;

    const btn = session.buttons[index];

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('Gerenciar Botão')
          .setDescription(`**Nome:** ${btn.label}\n**Valor:** ${btn.valor}`)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('editar_botao').setLabel('Editar').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('excluir_botao').setLabel('Excluir').setStyle(ButtonStyle.Danger)
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('gerenciar_botoes').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

} // 🔥 FECHA AQUI!!!

    if (interaction.isButton()) {
      const id = interaction.customId;

if (id === 'editar_botao') {

  const index = session.botaoAtual;
  const btn = session.buttons[index];

  const modal = new ModalBuilder()
    .setCustomId('editar_botao_modal')
    .setTitle('Editar botão');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('label')
        .setLabel('Nome')
        .setStyle(TextInputStyle.Short)
        .setValue(btn.label)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('valor')
        .setLabel('Mensagem ou link')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(btn.valor)
    )
  );

  return interaction.showModal(modal);
}
      
if (id === 'excluir_botao') {

  const index = session.botaoAtual;

  if (index === undefined) {
    return interaction.reply({ content: 'Erro.', ephemeral: true });
  }

  session.buttons.splice(index, 1);
  session.botaoAtual = undefined; // 🔥 IMPORTANTE

  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor('#2b2d31')
        .setDescription('Botão excluído!')
    ],
    components: gerarMenu(interaction.user.id)
  });
}
      
      if (id === 'gerenciar_botoes') {

  if (!session.buttons.length) {
    return interaction.reply({
      content: 'Você não tem botões ainda.',
      ephemeral: true
    });
  }

  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('Gerenciar Botões')
        .setDescription('Selecione um botão abaixo')
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_button')
          .setPlaceholder('Escolher botão')
          .addOptions(
            session.buttons.map((btn, i) => ({
              label: btn.label,
              value: `${i}`
            }))
          )
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
      )
    ]
  });
}
      
      if (id === 'delete') {

  if (session.embeds.length <= 1) {
    return interaction.reply({
      content: 'Você precisa ter pelo menos 1 embed.',
      ephemeral: true
    });
  }

  session.embeds.splice(session.atual, 1);

  // Ajusta o índice
  if (session.atual >= session.embeds.length) {
    session.atual = session.embeds.length - 1;
  }

  return interaction.update({
    embeds: [montarEmbed(session.embeds[session.atual])],
    components: gerarMenu(interaction.user.id)
  });
}

      if (id === 'add_embed') {
        session.embeds.push({
          title: 'Novo Embed',
          description: 'Lembre-se que seu Embed não pode ser vazio!'
        });
        session.atual = session.embeds.length - 1;

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

  // Se estiver gerenciando botão, volta pra lista de botões
  if (session.botaoAtual !== undefined) {
    session.botaoAtual = undefined;

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('Gerenciar Botões')
          .setDescription('Selecione um botão abaixo')
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_button')
            .setPlaceholder('Escolher botão')
            .addOptions(
              session.buttons.map((btn, i) => ({
                label: btn.label,
                value: `${i}`
              }))
            )
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
  .setCustomId('voltar')
  .setLabel('Voltar ao menu')
  .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  // Volta pro menu normal
  return interaction.update({
    embeds: [montarEmbed(atual)],
    components: gerarMenu(interaction.user.id)
  });
}

      if (id === 'add_button') {
        const modal = new ModalBuilder()
          .setCustomId('criar_botao')
          .setTitle('Adicionar botão');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('label').setLabel('Nome do botão').setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel('Mensagem ou link').setStyle(TextInputStyle.Paragraph)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cor').setLabel('Cor: azul, verde, cinza, preto').setStyle(TextInputStyle.Short).setRequired(false)
          )
        );

        return interaction.showModal(modal);
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
              new ButtonBuilder().setLabel(btn.label).setStyle(btn.style).setCustomId(`msg_${i}`)
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

      if (['titulo','desc','imagem','thumb','autor'].includes(id)) {

        if (id === 'autor') {
          const modal = new ModalBuilder()
            .setCustomId('autor_modal')
            .setTitle('Autor');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('nome').setLabel('Nome do autor').setStyle(TextInputStyle.Short).setValue(atual.author?.nome || '').setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('icon').setLabel('URL da imagem').setStyle(TextInputStyle.Short).setValue(atual.author?.icon || '').setRequired(false)
            )
          );

          return interaction.showModal(modal);
        }

        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle(`Editar ${id}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel(
                id === 'imagem' ? 'URL da imagem' :
                id === 'thumb' ? 'URL da thumbnail' :
                `Digite ${id}`
              )
              .setStyle(TextInputStyle.Paragraph)
              .setValue(
                id === 'titulo' ? (atual.title || '') :
                id === 'desc' ? (atual.description || '') :
                id === 'imagem' ? (atual.image || '') :
                id === 'thumb' ? (atual.thumbnail || '') :
                ''
              )
              .setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit()) {

      let atual = session.embeds[session.atual];

      if (interaction.customId === 'editar_botao_modal') {

  const index = session.botaoAtual;

  const label = interaction.fields.getTextInputValue('label');
  const valor = interaction.fields.getTextInputValue('valor');

  session.buttons[index].label = label;
  session.buttons[index].valor = valor;

  return interaction.reply({
    content: 'Botão editado!',
    ephemeral: true
  });
}

      if (interaction.customId === 'criar_botao') {
        const label = interaction.fields.getTextInputValue('label');
        const valor = interaction.fields.getTextInputValue('valor');
        let cor = interaction.fields.getTextInputValue('cor')?.toLowerCase();

        let style = ButtonStyle.Secondary;
        if (cor === 'azul') style = ButtonStyle.Primary;
        if (cor === 'verde') style = ButtonStyle.Success;
        if (cor === 'preto') style = ButtonStyle.Secondary;

        session.buttons.push({ label, valor, style });

        return interaction.reply({ content: 'Botão criado!', ephemeral: true });
      }

      if (interaction.customId === 'autor_modal') {
        const nome = interaction.fields.getTextInputValue('nome');
        const icon = interaction.fields.getTextInputValue('icon');

        atual.author = { nome, icon };

        return interaction.update({
          embeds: [montarEmbed(atual)],
          components: gerarEditor()
        });
      }

      const valor = interaction.fields.getTextInputValue('input');

      if (interaction.customId === 'titulo') atual.title = valor;
      if (interaction.customId === 'desc') atual.description = valor;
      if (interaction.customId === 'imagem') atual.image = valor;
      if (interaction.customId === 'thumb') atual.thumbnail = valor;

      return interaction.update({
        embeds: [montarEmbed(atual)],
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
  embed.setDescription(data.description || '‎');

  if (data.image) embed.setImage(data.image);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  if (data.author) {
    embed.setAuthor({
      name: data.author.nome || '‎',
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
      new ButtonBuilder().setCustomId('delete').setLabel('Excluir').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('add_button').setLabel('Adicionar botão').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('gerenciar_botoes').setLabel('Gerenciar botões').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(ButtonStyle.Secondary),
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
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumb').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('autor').setLabel('Autor').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(ButtonStyle.Primary)
    )
  ];
}

// ===== WEB =====
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot online'));
app.listen(PORT);

const commands = [
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Abrir painel de embed'),

  new SlashCommandBuilder()
    .setName('avaliar')
    .setDescription('Enviar avaliação')
    .addStringOption(option =>
      option.setName('texto')
        .setDescription('Digite a avaliação')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registrando comandos...');

await rest.put(
  Routes.applicationGuildCommands('1485623307364466861', '1411478770824511652'),
  { body: [] }
);

    console.log('Comandos registrados!');
  } catch (error) {
    console.error(error);
  }
})();

// ===== LOGIN =====
client.login(TOKEN);
