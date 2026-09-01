```js
import { ChannelType, PermissionFlagsBits } from 'discord.js';

export default {
    name: 'vc-setup',
    description: 'Setup the Join To Create system',

    async execute(message) {
        if (!message.member.permissions.has(
            PermissionFlagsBits.ManageChannels
        )) {
            return message.reply(
                'You need Manage Channels to use this command.'
            );
        }

        let category = message.guild.channels.cache.find(
            channel =>
                channel.type === ChannelType.GuildCategory &&
                channel.name === 'VOICE'
        );

        if (!category) {
            category = await message.guild.channels.create({
                name: 'VOICE',
                type: ChannelType.GuildCategory
            });
        }

        let joinChannel = message.guild.channels.cache.find(
            channel =>
                channel.type === ChannelType.GuildVoice &&
                channel.name === 'Join To Create' &&
                channel.parentId === category.id
        );

        if (!joinChannel) {
            joinChannel = await message.guild.channels.create({
                name: 'Join To Create',
                type: ChannelType.GuildVoice,
                parent: category.id
            });
        }

        return message.reply(
            'VC system setup complete.\n' +
            'Join the Join To Create channel to create your personal VC.'
        );
    }
};
```
