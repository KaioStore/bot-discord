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

if (fs.existsSync('./db.json')) db = JSON.parse(fs.readFileSync('./db.json'));
if (fs.existsSync('./gastos.json')) gastos = JSON.parse(fs.readFileSync('./gastos.json'));

function salvar() {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
  fs.writeFileSync('./gastos.json', JSON.stringify(gastos, null, 2));
}

// ===== EMBED SYSTEM =====
const embedSessions = {};

// ===== READY =====
client.on('clientReady', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async (interaction) => {
  try {

    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    // ================= COMANDOS =================
    if (interaction.isChatInputCommand()) {

      // ===== EMBED =====
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
          flags: 64
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
          flags: 64
        });
      }

      // ===== GASTAR =====
      if (interaction.commandName === 'gastar') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', flags: 64 });

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        gastos[user.id] = (gastos[user.id] || 0) + valor;
        salvar();

        return interaction.reply({ content: `Adicionado R$${valor} para ${user.username}`, flags: 64 });
      }

      // ===== REMOVER =====
      if (interaction.commandName === 'removergasto') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', flags: 64 });

        const user = interaction.options.getUser('usuario');
        const valor = interaction.options.getNumber('valor');

        gastos[user.id] = (gastos[user.id] || 0) - valor;
        if (gastos[user.id] < 0) gastos[user.id] = 0;
        salvar();

        return interaction.reply({ content: `Removido R$${valor} de ${user.username}`, flags: 64 });
      }

      // ===== AVALIAR =====
      if (interaction.commandName === 'avaliar') {
        if (!isAdmin) return interaction.reply({ content: 'Só administradores.', flags: 64 });

        const texto = interaction.options.getString('texto');

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

        return interaction.reply({ content: 'Avaliação enviada.', flags: 64 });
      }

      // ===== RANK COMPLETO =====
      if (interaction.commandName === 'rank') {

        const ranking = Object.entries(gastos).sort((a,b)=>b[1]-a[1]);

        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('🏆 Ranking de Clientes')
          .setDescription(
            ranking.map(([id,total],i)=>{

              let vip = "Sem cargo";
              if (total >= 1000) vip = "Diamante";
              else if (total >= 500) vip = "Ouro";
              else if (total >= 300) vip = "Prata";
              else if (total >= 100) vip = "Bronze";

              let prox = '';
              let falta = 0;

              if (vip === 'Sem cargo') { prox='Bronze'; falta=100-total }
              else if (vip === 'Bronze') { prox='Prata'; falta=300-total }
              else if (vip === 'Prata') { prox='Ouro'; falta=500-total }
              else if (vip === 'Ouro') { prox='Diamante'; falta=1000-total }

              return `**${i+1}º** - [<@${id}>](${SITE}/user/${id})
💰 R$${total} — 🏆 ${vip}
> Continue comprando para atingir **${prox}**${falta>0?` (faltam R$${falta})`:''}`;
            }).join('\n\n')
          );

        return interaction.reply({ embeds:[embed] });
      }
    }

    // ================= EMBED SYSTEM =================
    const session = embedSessions[interaction.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual] ||= {};

    if (interaction.isStringSelectMenu()) {
      session.atual = Number(interaction.values[0]);
      return interaction.update({
        embeds:[montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    if (interaction.isButton()) {

      const id = interaction.customId;

      if (['titulo','desc','imagem','thumb','autor'].includes(id)) {
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId(id)
            .setTitle('Editar')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('input')
                  .setLabel('Digite')
                  .setStyle(id==='desc'?2:1)
              )
            )
        );
      }

      if (id === 'add_embed') {
        session.embeds.push({});
        session.atual = session.embeds.length - 1;
      }

      if (id === 'delete') {
        session.embeds.splice(session.atual,1);
        if (!session.embeds.length) session.embeds=[{}];
        session.atual=0;
      }

      if (id === 'edit') {
        return interaction.update({
          embeds:[montarEmbed(atual)],
          components: gerarEditor()
        });
      }

      if (id === 'voltar') {
        return interaction.update({
          embeds:[montarEmbed(atual)],
          components: gerarMenu(interaction.user.id)
        });
      }

      if (id === 'enviar') {
        await interaction.channel.send({
          embeds: session.embeds.map(montarEmbed)
        });

        return interaction.reply({ content:'Enviado!', flags:64 });
      }

      return interaction.update({
        embeds:[montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    if (interaction.isModalSubmit()) {

      const valor = interaction.fields.getTextInputValue('input') || '⠀';

      if (interaction.customId === 'titulo') atual.title = valor;
      if (interaction.customId === 'desc') atual.description = valor;
      if (interaction.customId === 'imagem') atual.image = valor;
      if (interaction.customId === 'thumb') atual.thumbnail = valor;

      if (interaction.customId === 'autor') {
        atual.author = {
          nome: valor,
          url: valor.startsWith('http') ? valor : null
        };
      }

      return interaction.update({
        embeds:[montarEmbed(atual)],
        components: gerarEditor()
      });
    }

  } catch (err) {
    console.error(err);
  }
});

// ===== FUNÇÕES =====
function montarEmbed(d){
  const e = new EmbedBuilder().setColor('#2b2d31');

  if (d.title) e.setTitle(d.title);
  e.setDescription(d.description || '⠀');
  if (d.image) e.setImage(d.image);
  if (d.thumbnail) e.setThumbnail(d.thumbnail);

  if (d.author) {
    e.setAuthor({
      name: d.author.nome || '⠀',
      url: d.author.url || undefined
    });
  }

  return e;
}

function gerarMenu(userId){
  const s = embedSessions[userId];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .setPlaceholder('Selecionar embed')
        .addOptions(s.embeds.map((_,i)=>({
          label:`Embed ${i+1}`,
          value:`${i}`
        })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_embed').setLabel('Adicionar embed').setStyle(2),
      new ButtonBuilder().setCustomId('edit').setLabel('Editar').setStyle(2),
      new ButtonBuilder().setCustomId('delete').setLabel('Deletar').setStyle(4),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(3)
    )
  ];
}

function gerarEditor(){
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(2),
      new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(2),
      new ButtonBuilder().setCustomId('imagem').setLabel('Imagem').setStyle(2),
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumbnail').setStyle(2)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('autor').setLabel('Autor').setStyle(2),
      new ButtonBuilder().setCustomId('voltar').setLabel('Voltar').setStyle(1)
    )
  ];
}

// ===== WEB =====
app.get('/', (req,res)=>res.send('Bot online'));
app.listen(process.env.PORT||3000);

// ===== LOGIN =====
client.login(TOKEN);
