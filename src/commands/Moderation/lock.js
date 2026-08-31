import { PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
    name: 'lock',
    description: 'Lock the current channel',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],

    async execute(message, args, config, client) {
        await message.channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            { SendMessages: false }
        );

        await message.channel.send({
            embeds: [
                successEmbed(
                    '🔒 **Channel Locked**',
                    `Locked by ${message.author}.`
                ),
            ],
        });
    },
};
