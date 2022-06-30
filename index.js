const { MessageEmbed, MessageButton, MessageActionRow } = require("discord.js");
const { Token } = require("./config.json");
const { Client } = require("discord.js");
const db = require("./db");


const prefix = "$";

const client = new Client({ intents: 32767 });

client.once("ready", () => {
    console.log(`[LOGIN] ${client.user.username}`);
});




    


client.on("messageCreate", async (message) => {

    if (!message.guild || message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const commandName = args.shift().toLowerCase();

    if (commandName == "setup") {
        if (!message.member.permissions.has("ADMINISTRATOR"))
            return message.reply({ content: "You are not allowed to setup the ticket system!" });

        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        if (!role) return message.reply({ content: "You have to provide a support role by mention or id!" }).catch((e) => console.error(e));

        db.query("SELECT * FROM ticket_system WHERE guild =?", [message.guild.id], async (err, data) => {
            if (err) throw err;

            if (!data[0]) {
                const category = await message.guild.channels.create("Ticket Support", {
                    type: "GUILD_CATEGORY",
                    permissionOverwrites: [
                        {
                            id: message.guild.id,
                            allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
                            deny: ["SEND_MESSAGES", "ADD_REACTIONS"]
                        }
                    ],
                }).catch((e) => console.error(e));

                if (!category) return message.reply({ content: "I do not have enough permissions to setup the ticket system!" }).catch((e) => console.error(e));

                const channel = await category.createChannel("Ticket Erstellen", {
                    type: "GUILD_TEXT",
                    permissionOverwrites: [
                        {
                            id: message.guild.id,
                            allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
                            deny: ["SEND_MESSAGES", "ADD_REACTIONS"]
                        }
                    ],
                }).catch((e) => console.error(e));

                if (!channel) return message.reply({ content: "I do not have enough permissions to setup the ticket system!" }).catch((e) => console.error(e));

                const embed = new MessageEmbed()
                    .setColor("#5768a1")
                    .setTitle("Tickets")
                    .setDescription("Click on \`Open a Ticket\` to create a ticket!");

                const button = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setStyle("PRIMARY")
                            .setLabel("Open a Ticket")
                            .setCustomId("open-ticket")
                    );

                const msg = await channel.send({ embeds: [embed], components: [button] }).catch((e) => console.error(e));

                db.query("INSERT INTO ticket_system(guild, category, channel, message, role, count) VALUES(?, ?, ?, ?, ?, ?)", [message.guild.id, category.id, channel.id, msg.id, role.id, 0], (err) => {
                    if (err) throw err;
                });
            } else {
                return message.reply({ content: "Ticket system has already been setup!" }).catch((e) => console.error(e));
            };
        });
    };
    if (commandName == "reset") {
        if (!message.member.permissions.has("ADMINISTRATOR"))
            return message.reply({ content: "You are not allowed to setup the ticket system!" });

        db.query("SELECT * FROM ticket_system WHERE guild =?", [message.guild.id], async (err, data) => {
            if (err) throw err;

            if (data[0]) {
                const ticket = {
                    guild: data[0].guild,
                    category: data[0].category,
                    channel: data[0].channel,
                    role: data[0].role,
                    message: data[0].message,
                    count: data[0].count
                };

                db.query("DELETE FROM ticket_system WHERE guild =?", [message.guild.id], async (err) => {
                    if (err) throw err;

                    db.query("DELETE FROM tickets WHERE guild =?", [message.guild.id], async (err) => {
                        if (err) throw err;

                        const category = message.guild.channels.cache.get(ticket.category);
                        const channel = message.guild.channels.cache.get(ticket.channel);
                        const msg = await channel?.messages.fetch(ticket.message).catch((e) => console.error(e));

                        msg.delete().catch(() => null);
                        channel.delete().catch(() => null);
                        category.delete().catch(() => null);

                        return message.reply({ content: "The ticket system has been reset!" }).catch((e) => console.error(e));
                    });
                });
            } else {
                return message.reply({ content: "The ticket system has not been setup!" }).catch((e) => console.error(e));
            };
        });
    };
});

client.on("interactionCreate", async (interaction) => {

    if (!interaction.isButton()) return;

    db.query("SELECT * FROM ticket_system WHERE guild =?", [interaction.guild.id], async (err, data) => {
        if (err) throw err;

        if (data[0]) {
            await interaction.deferUpdate().catch(() => null);

            const ticket = {
                guild: data[0].guild,
                category: data[0].category,
                channel: data[0].channel,
                role: data[0].role,
                message: data[0].message,
                count: data[0].count
            };

            const category = interaction.guild.channels.cache.get(ticket.category);
            if (!category) {
                dropTicketData(interaction.guild.id);
                return interaction.followUp({ content: "The ticket system has not been setup!", ephemeral: true }).catch((e) => console.error(e));
            };

            const channel = interaction.guild.channels.cache.get(ticket.channel);
            if (!channel) {
                dropTicketData(interaction.guild.id);
                return interaction.followUp({ content: "The ticket system has not been setup!", ephemeral: true }).catch((e) => console.error(e));
            };

            const role = interaction.guild.roles.cache.get(ticket.role);
            if (!role) {
                dropTicketData(interaction.guild.id);
                return interaction.followUp({ content: "The ticket system has not been setup!", ephemeral: true }).catch((e) => console.error(e));
            };

            if (interaction.customId.toLowerCase() == "open-ticket") {
                db.query("SELECT * FROM tickets WHERE guild =? AND user =?", [interaction.guild.id, interaction.user.id], async (err, data) => {
                    if (err) throw err;

                    if (!data[0]) {
                        const channel = await category.createChannel(`${ticket.count + 1}-ticket-${interaction.user.username}`, {
                            type: "GUILD_TEXT",
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: ["VIEW_CHANNEL"]
                                },
                                {
                                    id: interaction.user.id,
                                    deny: ["MANAGE_MESSAGES"],
                                    allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"]
                                },
                                {
                                    id: role.id,
                                    deny: ["MANAGE_MESSAGES"],
                                    allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"]
                                }
                            ],
                        }).catch((e) => console.error(e));

                        if (!channel) return interaction.followUp({ content: "I do not have enough permissions to create a ticket!", ephemeral: true }).catch((e) => console.error(e));

                        const embed = new MessageEmbed()
                            .setColor("#5768a1")
                            .setTitle(`${ticket.count + 1} - Ticket - ${interaction.user.tag}`)
                            .setDescription("Welcome to your ticket! \nPlease be patient and try to explain your problem.");

                        const button = new MessageActionRow()
                            .addComponents(
                                new MessageButton()
                                    .setStyle("DANGER")
                                    .setLabel("Close Ticket")
                                    .setCustomId("close-ticket")
                            );

                        channel.send({ content: `<@${interaction.user.id}> <@&${role.id}>`, embeds: [embed], components: [button] }).catch((e) => console.error(e));

                        interaction.followUp({ content: `Your ticket has been created in ${channel}!`, ephemeral: true }).catch((e) => console.error(e));

                        db.query("UPDATE ticket_system SET count = count + 1", (err) => {
                            if (err) throw err;

                            db.query("INSERT INTO tickets(guild, user, channel) VALUES(?, ?, ?)", [interaction.guild.id, interaction.user.id, channel.id], (err) => {
                                if (err) throw err;
                            });
                        });
                    } else {
                        return interaction.followUp({ content: "You already have a ticket open!", ephemeral: true }).catch((e) => console.error(e));
                    };
                });
            };
            if (interaction.customId.toLowerCase() == "close-ticket" && (interaction.member.roles.cache.has(role.id) || interaction.member.permissions.has("ADMINISTRATOR"))) {
                db.query("SELECT * FROM tickets WHERE guild =? AND channel =?", [interaction.guild.id, interaction.channel.id], (err, data) => {
                    if (err) throw err;

                    if (data[0]) {
                        db.query("DELETE FROM tickets WHERE guild =? AND channel =?", [interaction.guild.id, interaction.channel.id], (err) => {
                            if (err) throw err;

                            interaction.channel.delete().catch((e) => console.error(e));
                        });
                    } else {
                        interaction.followUp({ content: "This is not a valid ticket!", ephemeral: true }).catch((e) => console.error(e));
                    };
                });
            };
        } else {
            return interaction.followUp({ content: "The ticket system has not been setup!", ephemeral: true }).catch((e) => console.error(e));
        };
    });
});
function dropTicketData(guildId) {
    db.query("DELETE FROM ticket_system WHERE guild =?", [guildId], (err) => {
        if (err) throw err;
    });
};
    

client.login(Token).catch((e) => console.error(e));