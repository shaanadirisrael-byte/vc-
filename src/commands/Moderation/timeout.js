import { PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    name: 'timeout',
    description: 'Timeout a user',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],

    async execute(message, args, config, client) {
        const user = message.mentions.users.first();
        const duration = args[1];

        if (!user || !duration) {
            throw new TitanBotError(
                'Invalid usage',
                ErrorTypes.USER_INPUT,
                'Use: `-timeout @user 10m reason`'
            );
        }

        if (user.id === message.author.id) {
            throw new TitanBotError(
                'Cannot timeout self',
                ErrorTypes.VALIDATION,
                'You cannot timeout yourself.'
            );
        }

        const member = await message.guild.members.fetch(user.id);

        if (
            member.roles.highest.position >=
            message.member.roles.highest.position
        ) {
            throw new TitanBotError(
                'Role hierarchy',
                ErrorTypes.VALIDATION,
                'You cannot timeout someone with an equal or higher role.'
            );
        }

        const match = duration.match(/^(\d+)(s|m|h|d)$/i);

        if (!match) {
            throw new TitanBotError(
                'Invalid duration',
                ErrorTypes.USER_INPUT,
                'Use `30s`, `10m`, `1h`, or `1d`.'
            );
        }

        const amount = Number(match[1]);
        const unit = match[2].toLowerCase();

        const units = {
            s: 1000,
            m: 60000,
            h: 3600000,
            d: 86400000,
        };

        const milliseconds = amount * units[unit];

        if (milliseconds > 28 * 86400000) {
            throw new TitanBotError(
                'Timeout too long',
                ErrorTypes.VALIDATION,
                'Maximum timeout is 28 days.'
            );
        }

        const reason = args.slice(2).join(' ') || 'No reason provided';

        await member.timeout(milliseconds, reason);

        await message.channel.send({
            embeds: [
                successEmbed(
                    `⏱️ **Timed Out** ${user.tag}`,
                    `**Duration:** ${duration}\n**Reason:** ${reason}`
                ),
            ],
        });
    },
};
