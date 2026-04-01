const { REST, Routes } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1485623307364466861';
const GUILD_ID = '1411478770824511652';

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Limpando comandos...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: [] },
    );

    console.log('Comandos apagados!');
  } catch (error) {
    console.error(error);
  }
})();
