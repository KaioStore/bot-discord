const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = '';
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

  // ================= GASTAR =================
  new SlashCommandBuilder()
    .setName('gastar')
    .setDescription('Adicionar gasto')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuário')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option.setName('valor')
        .setDescription('Valor')
        .setRequired(true)
    ),

  // ================= REMOVER GASTO =================
  new SlashCommandBuilder()
    .setName('removergasto')
    .setDescription('Remover gasto')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuário')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option.setName('valor')
        .setDescription('Valor')
        .setRequired(true)
    ),

  // ================= SALDO =================
  new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Ver saldo')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuário')
        .setRequired(false)
    ),

  // ================= RANK =================
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Ranking de gastos')

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