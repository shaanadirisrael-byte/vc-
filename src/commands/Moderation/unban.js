import { PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    name: 'unban',
    description: 'Unban a user',
    category: 'moderation',
    permissions: [PermissionFlagsBits.BanMembers],

    async execute(message, args, config, client) {
        const userId = args[0];

        if (!userId) {
            throw new TitanBotError(
                'Missing user ID',
                ErrorTypes.USER_INPUT,
                'Use: `-unban <user ID>`'
            );
        }

        let user;

        try {
            user = await client.users.fetch(userId);
        } catch {
            throw new TitanBotError(
                'Invalid user',
                ErrorTypes.USER_INPUT,
                'That user ID is invalid.'
            );
        }

        try {
            await message.guild.members.unban(
                user.id,
                `Unbanned by ${message.author.tag}`
            );
        } catch {
            throw new TitanBotError(
                'User not banned',
                ErrorTypes.VALIDATION,
                'That user is not currently banned.'
            );
        }

        await message.channel.send({
            embeds: [
                successEmbed(
                    `🔓 **Unbanned** ${user.tag}`,
                    `**Moderator:** ${message.author}`
                ),
            ],
        });
    },
};
