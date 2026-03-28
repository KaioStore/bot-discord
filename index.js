// ===== EMBED SYSTEM =====
const embedSessions = {};

client.on('interactionCreate', async (interaction) => {
  try {
    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'embed') {
        embedSessions[interaction.user.id] = {
          embeds: [{}],
          atual: 0
        };

        return interaction.reply({
          embeds: [montarEmbed({ description: 'Editor de embed aberto' })],
          components: gerarMenu(interaction.user.id),
          ephemeral: true
        });
      }
    }

    const session = embedSessions[interaction.user.id];
    if (!session) return;

    let atual = session.embeds[session.atual];

    // 🔥 SELECT (PÁGINAS)
    if (interaction.isStringSelectMenu()) {
      session.atual = Number(interaction.values[0]);

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    // 🔥 BOTÕES
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === 'next') {
        if (session.atual < session.embeds.length - 1) session.atual++;
      }

      if (id === 'prev') {
        if (session.atual > 0) session.atual--;
      }

      if (id === 'add') {
        session.embeds.push({});
        session.atual = session.embeds.length - 1;
      }

      if (id === 'delete') {
        session.embeds.splice(session.atual, 1);
        if (session.embeds.length === 0) session.embeds.push({});
        session.atual = 0;
      }

      if (id === 'enviar') {
        await interaction.channel.send({
          embeds: session.embeds.map(e => montarEmbed(e))
        });

        return interaction.reply({ content: 'Enviado!', ephemeral: true });
      }

      // EDITAR
      if (['titulo','desc','imagem','thumb'].includes(id)) {
        const modal = new ModalBuilder()
          .setCustomId(id)
          .setTitle('Editar');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input')
              .setLabel('Digite')
              .setStyle(id === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          )
        );

        return interaction.showModal(modal);
      }

      return interaction.update({
        embeds: [montarEmbed(session.embeds[session.atual])],
        components: gerarMenu(interaction.user.id)
      });
    }

    // MODAL
    if (interaction.isModalSubmit()) {
      const valor = interaction.fields.getTextInputValue('input');

      if (interaction.customId === 'titulo') atual.title = valor || null;
      if (interaction.customId === 'desc') atual.description = valor || '⠀';

      if (interaction.customId === 'imagem') {
        if (!valor) delete atual.image;
        else atual.image = { url: valor };
      }

      if (interaction.customId === 'thumb') {
        if (!valor) delete atual.thumbnail;
        else atual.thumbnail = { url: valor };
      }

      return interaction.update({
        embeds: [montarEmbed(atual)],
        components: gerarEditor()
      });
    }

  } catch (err) {
    console.error(err);
  }
});

// ===== MENU COMPLETO =====
function gerarMenu(userId) {
  const session = embedSessions[userId];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .setPlaceholder(`Página ${session.atual + 1}`)
        .addOptions(
          session.embeds.map((e,i)=>({
            label:`Página ${i+1}`,
            value:`${i}`
          }))
        )
    ),

    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('add').setLabel('+').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('delete').setLabel('🗑').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('enviar').setLabel('Enviar').setStyle(ButtonStyle.Primary)
    ),

    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('titulo').setLabel('Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('desc').setLabel('Descrição').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('imagem').setLabel('Imagem').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary)
    )
  ];
}
