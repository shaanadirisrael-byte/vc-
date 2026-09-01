```js
import {
    Client,
    GatewayIntentBits,
    ChannelType,
} from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// =========================
// SETTINGS
// =========================

const VC_CATEGORY = 'VOICE';
const JOIN_CHANNEL = 'Join To Create';

// =========================
// READY
// =========================

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// =========================
// JOIN TO CREATE
// =========================

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        // User did not join a new channel
        if (!newState.channelId) return;

        // User joined something other than Join To Create
        if (newState.channel.name !== JOIN_CHANNEL) return;

        const guild = newState.guild;
        const member = newState.member;

        // Find the VOICE category
        let category = guild.channels.cache.find(
            channel =>
                channel.type === ChannelType.GuildCategory &&
                channel.name === VC_CATEGORY
        );

        // Create category if it doesn't exist
        if (!category) {
            category = await guild.channels.create({
                name: VC_CATEGORY,
                type: ChannelType.GuildCategory,
            });
        }

        // Create personal VC
        const channel = await guild.channels.create({
            name: `🔊 ${member.displayName}'s VC`,
            type: ChannelType.GuildVoice,
            parent: category.id,
        });

        // Move member into their new VC
        await member.voice.setChannel(channel);

        console.log(
            `Created VC ${channel.name} for ${member.user.tag}`
        );

    } catch (error) {
        console.error('Join To Create Error:', error);
    }
});

// =========================
// AUTO DELETE EMPTY VCS
// =========================

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const channel = oldState.channel;

        if (!channel) return;

        // Only look at channels inside the VOICE category
        if (
            channel.parent?.name !== VC_CATEGORY
        ) {
            return;
        }

        // Never delete Join To Create
        if (channel.name === JOIN_CHANNEL) {
            return;
        }

        // Delete when empty
        if (channel.members.size === 0) {
            await channel.delete().catch(() => {});
        }

    } catch (error) {
        console.error(
            'VC Auto Delete Error:',
            error
        );
    }
});

// =========================
// LOGIN
// =========================

client.login('YOUR_BOT_TOKEN');
```
