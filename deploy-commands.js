const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1485623307364466861';
const GUILD_ID = '1411478770824511652';

const commands = [
  // ================= AVALIAR =================
  new SlashCommandBuilder()
    .setName('avaliar')
    .setDescription('Enviar avaliação')
    .addStringOption(option =>
      option.setName('texto')
        .setDescription('Escreva a avaliação')
        .setRequired(true)
    ),

  // 🔥 EMBED (AGORA CERTO)
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Abrir painel embed')

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registrando comandos...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );

    console.log('Comandos registrados!');
  } catch (error) {
    console.error(error);
  }
})();
