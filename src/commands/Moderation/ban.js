```js
import { PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    name: 'ban',
    description: 'Ban a user from the server',
    category: 'moderation',
    permissions: [PermissionFlagsBits.BanMembers],

    async execute(message, args, config, client) {
        const user = message.mentions.users.first();
        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!user) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to ban. Example: `-ban @user reason`',
                { subtype: 'invalid_user' },
            );
        }

        if (user.id === message.author.id) {
            throw new TitanBotError(
                'Cannot ban self',
                ErrorTypes.VALIDATION,
                'You cannot ban yourself.',
            );
        }

        if (user.id === client.user.id) {
            throw new TitanBotError(
                'Cannot ban bot',
                ErrorTypes.VALIDATION,
                'You cannot ban the bot.',
            );
        }

        const member = await message.guild.members.fetch(user.id);

        if (member.id === message.guild.ownerId) {
            throw new TitanBotError(
                'Cannot ban owner',
                ErrorTypes.VALIDATION,
                'You cannot ban the server owner.',
            );
        }

        if (
            member.roles.highest.position >=
            message.member.roles.highest.position
        ) {
            throw new TitanBotError(
                'Role hierarchy',
                ErrorTypes.VALIDATION,
                'You cannot ban someone with an equal or higher role.',
            );
        }

        if (
            member.roles.highest.position >=
            message.guild.members.me.roles.highest.position
        ) {
            throw new TitanBotError(
                'Bot role hierarchy',
                ErrorTypes.VALIDATION,
                'My role must be higher than the user you are trying to ban.',
            );
        }

        const result = await ModerationService.banUser({
            guild: message.guild,
            user,
            moderator: message.member,
            reason,
        });

        await message.channel.send({
            embeds: [
                successEmbed(
                    `🚫 **Banned** ${user.tag}`,
                    `**Reason:** ${reason}\n**Case ID:** #${result.caseId}`,
                ),
            ],
        });
    },
};
```

### Command

```text
-ban @user
```

or:

```text
-ban @user spamming
```

### Important

Your command handler needs to pass:

```js
message
args
config
client
```

to `execute()` for this format to work. This keeps the same **service / error handler / embed structure** from your original code while changing the command from `/ban target reason` to **`-ban @user reason`**.
