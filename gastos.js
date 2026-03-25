const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = '';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Banco simples
let gastos = {};

client.on('ready', () => {
  console.log(`Bot de gastos online: ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  if (!gastos[userId]) {
    gastos[userId] = 0;
  }

  if (interaction.commandName === 'gastar') {
    const valor = interaction.options.getNumber('valor');

    gastos[userId] += valor;

    await interaction.reply(`💸 Você gastou R$${valor}. Total: R$${gastos[userId]}`);
  }

  if (interaction.commandName === 'saldo') {
    await interaction.reply(`💰 Seu saldo gasto é: R$${gastos[userId]}`);
  }
});

client.login(TOKEN);