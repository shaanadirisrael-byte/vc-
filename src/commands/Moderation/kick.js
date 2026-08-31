```js
import { PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    name: 'kick',
    description: 'Kick a user from the server',
    category: 'moderation',
    permissions: [PermissionFlagsBits.KickMembers],

    async execute(message, args, config, client) {
        const user = message.mentions.users.first();
        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!user) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to kick. Example: `-kick @user reason`',
                { subtype: 'invalid_user' },
            );
        }

        if (user.id === message.author.id) {
            throw new TitanBotError(
                'Cannot kick self',
                ErrorTypes.VALIDATION,
                'You cannot kick yourself.',
            );
        }

        if (user.id === client.user.id) {
            throw new TitanBotError(
                'Cannot kick bot',
                ErrorTypes.VALIDATION,
                'You cannot kick the bot.',
            );
        }

        const member = await message.guild.members.fetch(user.id);

        if (member.id === message.guild.ownerId) {
            throw new TitanBotError(
                'Cannot kick owner',
                ErrorTypes.VALIDATION,
                'You cannot kick the server owner.',
            );
        }

        if (
            member.roles.highest.position >=
            message.member.roles.highest.position
        ) {
            throw new TitanBotError(
                'Role hierarchy',
                ErrorTypes.VALIDATION,
                'You cannot kick someone with an equal or higher role.',
            );
        }

        if (
            member.roles.highest.position >=
            message.guild.members.me.roles.highest.position
        ) {
            throw new TitanBotError(
                'Bot role hierarchy',
                ErrorTypes.VALIDATION,
                'My role must be higher than the user you are trying to kick.',
            );
        }

        const result = await ModerationService.kickUser({
            guild: message.guild,
            user,
            moderator: message.member,
            reason,
        });

        await message.channel.send({
            embeds: [
                successEmbed(
                    `👢 **Kicked** ${user.tag}`,
                    `**Reason:** ${reason}\n**Case ID:** #${result.caseId}`,
                ),
            ],
        });
    },
};
```

### Usage

```text
-kick @user
```

or:

```text
-kick @user breaking server rules
```

This uses the same **service → error handler → success embed** structure as your `-ban` command.
