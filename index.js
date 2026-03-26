process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Promise rejeitada:', err);
});

const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot online!');
});

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CANAL_AVALIACOES = '1411493010268753930';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== BANCO =====
let db = { total: 419, pedidos: 450 };
if (fs.existsSync('./db.json')) {
  db = JSON.parse(fs.readFileSync('./db.json'));
}

function salvar() {
  fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
}

let gastos = {};
if (fs.existsSync('./gastos.json')) {
  gastos = JSON.parse(fs.readFileSync('./gastos.json'));
}

function salvarGastos() {
  fs.writeFileSync('./gastos.json', JSON.stringify(gastos, null, 2));
}

app.listen(3000, () => {
  console.log('Web server ligado');
});

// ===== BOT ONLINE =====
client.on('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

// ===== COMANDOS =====
client.on('interactionCreate', async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  try {

    // ===== AVALIAR =====
    if (interaction.commandName === 'avaliar') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Só administradores podem usar.', ephemeral: true });
      }

      const texto = interaction.options.getString('texto');

      await interaction.deferReply({ ephemeral: true });

      db.total++;
      db.pedidos++;
      salvar();

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('Avaliação Recebida')
        .setImage('https://cdn.discordapp.com/attachments/1317295856424325130/1317630916574580840/Linha2KPlayer.png')
        .setDescription(
`Avaliação: ${texto}
Total: ${db.total}
Pedido: ${db.pedidos}`
        );

      const canal = client.channels.cache.get(CANAL_AVALIACOES);
      if (canal) canal.send({ embeds: [embed] });

      return interaction.editReply('Avaliação enviada.');
    }

    // ===== GASTAR =====
    if (interaction.commandName === 'gastar') {

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Só administradores podem usar.', ephemeral: true });
      }

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

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Só administradores podem usar.', ephemeral: true });
      }

      const user = interaction.options.getUser('usuario');
      const valor = interaction.options.getNumber('valor');

      if (!gastos[user.id]) gastos[user.id] = 0;

      gastos[user.id] -= valor;

      if (gastos[user.id] <= 0) {
        delete gastos[user.id];
      }

      salvarGastos();

      return interaction.reply({
        content: `Gasto removido de ${user.username}`,
        ephemeral: true
      });
    }

    // ===== RANK =====
    if (interaction.commandName === 'rank') {

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

          texto += `${medalha} [${username}](${link})\n💰 R$${valor}\n\n`;
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

      const msg = await interaction.reply({
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
