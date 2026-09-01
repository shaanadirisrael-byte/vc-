```js
import {
    ChannelType,
    PermissionFlagsBits,
} from 'discord.js';

const VC_CATEGORY = 'VOICE';
const JOIN_CHANNEL = 'Join To Create';

export default {
    name: 'vc',
    description: 'Voice channel system',
    category: 'voice',

    async execute(message, args) {
        const sub = args[0]?.toLowerCase();

        // SETUP
        if (sub === 'setup') {
            if (!message.member.permissions.has(
                PermissionFlagsBits.ManageChannels
            )) {
                return message.channel.send(
                    'You need Manage Channels.'
                );
            }

            let category = message.guild.channels.cache.find(
                channel =>
                    channel.type === ChannelType.GuildCategory &&
                    channel.name === VC_CATEGORY
            );

            if (!category) {
                category = await message.guild.channels.create({
                    name: VC_CATEGORY,
                    type: ChannelType.GuildCategory,
                });
            }

            let joinChannel = message.guild.channels.cache.find(
                channel =>
                    channel.type === ChannelType.GuildVoice &&
                    channel.name === JOIN_CHANNEL &&
                    channel.parentId === category.id
            );

            if (!joinChannel) {
                joinChannel = await message.guild.channels.create({
                    name: JOIN_CHANNEL,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                });
            }

            return message.channel.send(
                'VC system setup complete.'
            );
        }

        // CREATE
        if (sub === 'create') {
            const category = message.guild.channels.cache.find(
                channel =>
                    channel.type === ChannelType.GuildCategory &&
                    channel.name === VC_CATEGORY
            );

            if (!category) {
                return message.channel.send(
                    'Use -vc setup first.'
                );
            }

            const vc = await message.guild.channels.create({
                name: `${message.member.displayName}'s VC`,
                type: ChannelType.GuildVoice,
                parent: category.id,
            });

            await vc.permissionOverwrites.edit(
                message.member.id,
                {
                    Connect: true,
                    Speak: true,
                    ManageChannels: true,
                }
            );

            if (message.member.voice.channel) {
                await message.member.voice.setChannel(vc);
            }

            return message.channel.send(
                `Created ${vc}.`
            );
        }

        // DELETE
        if (sub === 'delete') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    'You are not in a VC.'
                );
            }

            if (
                vc.parent?.name !== VC_CATEGORY ||
                vc.name === JOIN_CHANNEL
            ) {
                return message.channel.send(
                    'This is not a personal VC.'
                );
            }

            if (!vc.permissionOverwrites.has(
                message.member.id
            )) {
                return message.channel.send(
                    'You do not own this VC.'
                );
            }

            await vc.delete();

            return message.channel.send(
                'VC deleted.'
            );
        }

        // RENAME
        if (sub === 'rename') {
            const name = args.slice(1).join(' ');

            if (!name) {
                return message.channel.send(
                    'Use -vc rename <name>'
                );
            }

            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    'You are not in a VC.'
                );
            }

            if (!vc.permissionOverwrites.has(
                message.member.id
            )) {
                return message.channel.send(
                    'You do not own this VC.'
                );
            }

            await vc.setName(name);

            return message.channel.send(
                `VC renamed to ${name}.`
            );
        }

        // LIMIT
        if (sub === 'limit') {
            const amount = Number(args[1]);

            if (
                Number.isNaN(amount) ||
                amount < 0 ||
                amount > 99
            ) {
                return message.channel.send(
                    'Use a number from 0 to 99.'
                );
            }

            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    'You are not in a VC.'
                );
            }

            if (!vc.permissionOverwrites.has(
                message.member.id
            )) {
                return message.channel.send(
                    'You do not own this VC.'
                );
            }

            await vc.setUserLimit(amount);

            return message.channel.send(
                `VC limit set to ${
                    amount === 0 ? 'Unlimited' : amount
                }.`
            );
        }

        // LOCK
        if (sub === 'lock') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    'You are not in a VC.'
                );
            }

            if (!vc.permissionOverwrites.has(
                message.member.id
            )) {
                return message.channel.send(
                    'You do not own this VC.'
                );
            }

            await vc.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    Connect: false,
                }
            );

            return message.channel.send(
                'VC locked.'
            );
        }

        // UNLOCK
        if (sub === 'unlock') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    'You are not in a VC.'
                );
            }

            if (!vc.permissionOverwrites.has(
                message.member.id
            )) {
                return message.channel.send(
                    'You do not own this VC.'
                );
            }

            await vc.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    Connect: null,
                }
            );

            return message.channel.send(
                'VC unlocked.'
            );
        }

        // STFU
        if (sub === 'stfu') {
            const member =
                message.mentions.members.first();

            const vc = message.member.voice.channel;

            if (!member) {
                return message.channel.send(
                    'Use -vc stfu @user'
                );
            }

            if (!vc || member.voice.channelId !== vc.id) {
                return message.channel.send(
                    'That user is not in your VC.'
                );
            }

            await member.voice.setMute(true);

            return message.channel.send(
                `${member.user.tag} has been muted.`
            );
        }

        // UNSTFU
        if (sub === 'unstfu') {
            const member =
                message.mentions.members.first();

            if (!member) {
                return message.channel.send(
                    'Use -vc unstfu @user'
                );
            }

            await member.voice.setMute(false);

            return message.channel.send(
                `${member.user.tag} has been unmuted.`
            );
        }

        // KICK
        if (sub === 'kick') {
            const member =
                message.mentions.members.first();

            const vc = message.member.voice.channel;

            if (!member) {
                return message.channel.send(
                    'Use -vc kick @user'
                );
            }

            if (!vc || member.voice.channelId !== vc.id) {
                return message.channel.send(
                    'That user is not in your VC.'
                );
            }

            if (!vc.permissionOverwrites.has(
                message.member.id
            )) {
                return message.channel.send(
                    'You do not own this VC.'
                );
            }

            await member.voice.disconnect();

            return message.channel.send(
                `${member.user.tag} was removed.`
            );
        }

        // TRANSFER
        if (sub === 'transfer') {
            const member =
                message.mentions.members.first();

            const vc = message.member.voice.channel;

            if (!member) {
                return message.channel.send(
                    'Use -vc transfer @user'
                );
            }

            if (!vc) {
                return message.channel.send(
                    'You are not in a VC.'
                );
            }

            if (!vc.permissionOverwrites.has(
                message.member.id
            )) {
                return message.channel.send(
                    'You do not own this VC.'
                );
            }

            await vc.permissionOverwrites.edit(
                message.member.id,
                {
                    ManageChannels: false,
                }
            );

            await vc.permissionOverwrites.edit(
                member.id,
                {
                    Connect: true,
                    Speak: true,
                    ManageChannels: true,
                }
            );

            return message.channel.send(
                `Ownership transferred to ${member.user.tag}.`
            );
        }

        // INFO
        if (sub === 'info') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    'You are not in a VC.'
                );
            }

            return message.channel.send(
                `VC: ${vc.name}\n` +
                `Users: ${vc.members.size}\n` +
                `Limit: ${vc.userLimit || 'Unlimited'}`
            );
        }

        // HELP
        return message.channel.send(
            'VC Commands\n\n' +
            '-vc setup\n' +
            '-vc create\n' +
            '-vc delete\n' +
            '-vc rename <name>\n' +
            '-vc limit <number>\n' +
            '-vc lock\n' +
            '-vc unlock\n' +
            '-vc stfu @user\n' +
            '-vc unstfu @user\n' +
            '-vc kick @user\n' +
            '-vc transfer @user\n' +
            '-vc info'
        );
    },
};
```
