import {
    Client,
    GatewayIntentBits,
    ChannelType,
    PermissionFlagsBits,
} from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const PREFIX = '-';
const VC_CATEGORY = 'VOICE';
const JOIN_CHANNEL = 'Join To Create';

// =========================
// RANKS
// =========================

const RANKS = {
    MEMBER: 0,
    STAFF: 1,
    'TRIAL MOD': 2,
    MOD: 3,
    'HEAD MOD': 4,
    ADMIN: 5,
    'CO OWNER': 6,
    OWNER: 7,
    GOD: 8,
    FOUNDER: 9,
};

function getRank(member) {
    let highest = 0;

    for (const role of member.roles.cache.values()) {
        const rank = RANKS[role.name.toUpperCase()];

        if (rank !== undefined && rank > highest) {
            highest = rank;
        }
    }

    return highest;
}

function hasRank(member, rank) {
    return getRank(member) >= RANKS[rank];
}

function rankCheck(message, rank) {
    if (!hasRank(message.member, rank)) {
        message.channel.send(
            `❌ You need **${rank}** or higher to use this command.`
        );
        return false;
    }

    return true;
}

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
        if (!newState.channel) return;

        if (newState.channel.name !== JOIN_CHANNEL) return;

        const guild = newState.guild;
        const member = newState.member;

        let category = guild.channels.cache.find(
            channel =>
                channel.type === ChannelType.GuildCategory &&
                channel.name === VC_CATEGORY
        );

        if (!category) {
            category = await guild.channels.create({
                name: VC_CATEGORY,
                type: ChannelType.GuildCategory,
            });
        }

        const vc = await guild.channels.create({
            name: `🔊 ${member.displayName}'s VC`,
            type: ChannelType.GuildVoice,
            parent: category.id,
        });

        await vc.permissionOverwrites.edit(member, {
            Connect: true,
            Speak: true,
            ManageChannels: true,
        });

        await member.voice.setChannel(vc);

        console.log(
            `Created ${vc.name} for ${member.user.tag}`
        );

    } catch (error) {
        console.error('Join To Create Error:', error);
    }
});

// =========================
// DELETE EMPTY VCS
// =========================

client.on('voiceStateUpdate', async (oldState) => {
    try {
        const channel = oldState.channel;

        if (!channel) return;

        if (
            channel.parent?.name !== VC_CATEGORY ||
            channel.name === JOIN_CHANNEL
        ) {
            return;
        }

        if (channel.members.size === 0) {
            await channel.delete().catch(() => {});
        }

    } catch (error) {
        console.error('VC Delete Error:', error);
    }
});

// =========================
// COMMAND HANDLER
// =========================

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const command = args.shift()?.toLowerCase();

    if (command !== 'vc') return;

    const sub = args[0]?.toLowerCase();

    try {

        // =========================
        // VC SETUP
        // =========================

        if (sub === 'setup') {
            if (!rankCheck(message, 'ADMIN')) return;

            let category = message.guild.channels.cache.find(
                c =>
                    c.type === ChannelType.GuildCategory &&
                    c.name === VC_CATEGORY
            );

            if (!category) {
                category = await message.guild.channels.create({
                    name: VC_CATEGORY,
                    type: ChannelType.GuildCategory,
                });
            }

            let join = message.guild.channels.cache.find(
                c =>
                    c.type === ChannelType.GuildVoice &&
                    c.name === JOIN_CHANNEL &&
                    c.parentId === category.id
            );

            if (!join) {
                join = await message.guild.channels.create({
                    name: JOIN_CHANNEL,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                });
            }

            return message.channel.send(
                `✅ **VC system setup complete.**\n` +
                `🔊 ${join.name}`
            );
        }

        // =========================
        // CREATE
        // =========================

        if (sub === 'create') {
            const category = message.guild.channels.cache.find(
                c =>
                    c.type === ChannelType.GuildCategory &&
                    c.name === VC_CATEGORY
            );

            if (!category) {
                return message.channel.send(
                    '❌ Use `-vc setup` first.'
                );
            }

            if (
                message.member.voice.channel &&
                message.member.voice.channel.parentId === category.id &&
                message.member.voice.channel.name !== JOIN_CHANNEL
            ) {
                return message.channel.send(
                    '❌ You already have a VC.'
                );
            }

            const vc = await message.guild.channels.create({
                name: `🔊 ${message.member.displayName}'s VC`,
                type: ChannelType.GuildVoice,
                parent: category.id,
            });

            await vc.permissionOverwrites.edit(
                message.member,
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
                `✅ Created ${vc}.`
            );
        }

        // =========================
        // DELETE
        // =========================

        if (sub === 'delete') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (
                vc.parent?.name !== VC_CATEGORY ||
                vc.name === JOIN_CHANNEL
            ) {
                return message.channel.send(
                    '❌ This is not a personal VC.'
                );
            }

            if (
                !vc.permissionOverwrites.has(
                    message.member.id
                )
            ) {
                return message.channel.send(
                    '❌ You do not own this VC.'
                );
            }

            await vc.delete();

            return message.channel.send(
                '🗑️ **Your VC was deleted.**'
            );
        }

        // =========================
        // RENAME
        // =========================

        if (sub === 'rename') {
            const name = args.slice(1).join(' ');

            if (!name) {
                return message.channel.send(
                    '❌ Use `-vc rename <name>`'
                );
            }

            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (
                vc.parent?.name !== VC_CATEGORY ||
                vc.name === JOIN_CHANNEL
            ) {
                return message.channel.send(
                    '❌ This is not a personal VC.'
                );
            }

            if (
                !vc.permissionOverwrites.has(
                    message.member.id
                )
            ) {
                return message.channel.send(
                    '❌ You do not own this VC.'
                );
            }

            await vc.setName(`🔊 ${name}`);

            return message.channel.send(
                `✏️ Renamed VC to **${name}**.`
            );
        }

        // =========================
        // LIMIT
        // =========================

        if (sub === 'limit') {
            const amount = Number(args[1]);

            if (
                Number.isNaN(amount) ||
                amount < 0 ||
                amount > 99
            ) {
                return message.channel.send(
                    '❌ Use a number between `0` and `99`.'
                );
            }

            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (
                vc.parent?.name !== VC_CATEGORY ||
                vc.name === JOIN_CHANNEL
            ) {
                return message.channel.send(
                    '❌ This is not a personal VC.'
                );
            }

            if (
                !vc.permissionOverwrites.has(
                    message.member.id
                )
            ) {
                return message.channel.send(
                    '❌ You do not own this VC.'
                );
            }

            await vc.setUserLimit(amount);

            return message.channel.send(
                `👥 Limit set to **${
                    amount === 0 ? 'Unlimited' : amount
                }**.`
            );
        }

        // =========================
        // LOCK
        // =========================

        if (sub === 'lock') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (
                vc.parent?.name !== VC_CATEGORY ||
                vc.name === JOIN_CHANNEL
            ) {
                return message.channel.send(
                    '❌ This is not a personal VC.'
                );
            }

            if (
                !vc.permissionOverwrites.has(
                    message.member.id
                )
            ) {
                return message.channel.send(
                    '❌ You do not own this VC.'
                );
            }

            await vc.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    Connect: false,
                }
            );

            return message.channel.send(
                '🔒 **VC locked.**'
            );
        }

        // =========================
        // UNLOCK
        // =========================

        if (sub === 'unlock') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (
                vc.parent?.name !== VC_CATEGORY ||
                vc.name === JOIN_CHANNEL
            ) {
                return message.channel.send(
                    '❌ This is not a personal VC.'
                );
            }

            if (
                !vc.permissionOverwrites.has(
                    message.member.id
                )
            ) {
                return message.channel.send(
                    '❌ You do not own this VC.'
                );
            }

            await vc.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    Connect: null,
                }
            );

            return message.channel.send(
                '🔓 **VC unlocked.**'
            );
        }

        // =========================
        // STFU
        // =========================

        if (sub === 'stfu') {
            if (!rankCheck(message, 'MOD')) return;

            const member =
                message.mentions.members.first();

            const vc = message.member.voice.channel;

            if (!member) {
                return message.channel.send(
                    '❌ Use `-vc stfu @user`'
                );
            }

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (member.voice.channelId !== vc.id) {
                return message.channel.send(
                    '❌ That user is not in your VC.'
                );
            }

            await member.voice.setMute(true);

            return message.channel.send(
                `🔇 **${member.user.tag}** has been muted.`
            );
        }

        // =========================
        // UNSTFU
        // =========================

        if (sub === 'unstfu') {
            if (!rankCheck(message, 'MOD')) return;

            const member =
                message.mentions.members.first();

            if (!member) {
                return message.channel.send(
                    '❌ Use `-vc unstfu @user`'
                );
            }

            await member.voice.setMute(false);

            return message.channel.send(
                `🔊 **${member.user.tag}** has been unmuted.`
            );
        }

        // =========================
        // VC KICK
        // =========================

        if (sub === 'kick') {
            const member =
                message.mentions.members.first();

            const vc = message.member.voice.channel;

            if (!member) {
                return message.channel.send(
                    '❌ Use `-vc kick @user`'
                );
            }

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (member.voice.channelId !== vc.id) {
                return message.channel.send(
                    '❌ That user is not in your VC.'
                );
            }

            if (
                !vc.permissionOverwrites.has(
                    message.member.id
                )
            ) {
                return message.channel.send(
                    '❌ You do not own this VC.'
                );
            }

            await member.voice.disconnect();

            return message.channel.send(
                `👢 **${member.user.tag}** was removed.`
            );
        }

        // =========================
        // CLAIM
        // =========================

        if (sub === 'claim') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (
                vc.parent?.name !== VC_CATEGORY ||
                vc.name === JOIN_CHANNEL
            ) {
                return message.channel.send(
                    '❌ This is not a personal VC.'
                );
            }

            const owner = vc.permissionOverwrites.cache.find(
                overwrite =>
                    overwrite.type === 1 &&
                    overwrite.allow.has(
                        PermissionFlagsBits.ManageChannels
                    )
            );

            if (owner) {
                return message.channel.send(
                    '❌ This VC already has an owner.'
                );
            }

            await vc.permissionOverwrites.edit(
                message.member,
                {
                    Connect: true,
                    Speak: true,
                    ManageChannels: true,
                }
            );

            return message.channel.send(
                `👑 **${message.author.tag}** claimed the VC.`
            );
        }

        // =========================
        // TRANSFER
        // =========================

        if (sub === 'transfer') {
            const member =
                message.mentions.members.first();

            const vc = message.member.voice.channel;

            if (!member) {
                return message.channel.send(
                    '❌ Use `-vc transfer @user`'
                );
            }

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            if (
                !vc.permissionOverwrites.has(
                    message.member.id
                )
            ) {
                return message.channel.send(
                    '❌ You do not own this VC.'
                );
            }

            await vc.permissionOverwrites.edit(
                message.member,
                {
                    ManageChannels: false,
                }
            );

            await vc.permissionOverwrites.edit(
                member,
                {
                    Connect: true,
                    Speak: true,
                    ManageChannels: true,
                }
            );

            return message.channel.send(
                `👑 Ownership transferred to **${member.user.tag}**.`
            );
        }

        // =========================
        // INFO
        // =========================

        if (sub === 'info') {
            const vc = message.member.voice.channel;

            if (!vc) {
                return message.channel.send(
                    '❌ You are not in a VC.'
                );
            }

            return message.channel.send(
                `🔊 **${vc.name}**\n` +
                `👥 Users: **${vc.members.size}**\n` +
                `🔢 Limit: **${
                    vc.userLimit || 'Unlimited'
                }**`
            );
        }

        // =========================
        // VC HELP
        // =========================

        return message.channel.send(
            '**🔊 VC Commands**\n\n' +
            '`-vc setup` — Setup Join To Create\n' +
            '`-vc create` — Create a VC\n' +
            '`-vc delete` — Delete your VC\n' +
            '`-vc rename <name>` — Rename your VC\n' +
            '`-vc limit <number>` — Set user limit\n' +
            '`-vc lock` — Lock your VC\n' +
            '`-vc unlock` — Unlock your VC\n' +
            '`-vc stfu @user` — Server mute user\n' +
            '`-vc unstfu @user` — Unmute user\n' +
            '`-vc kick @user` — Remove user\n' +
            '`-vc claim` — Claim a VC\n' +
            '`-vc transfer @user` — Transfer ownership\n' +
            '`-vc info` — Show VC information'
        );

    } catch (error) {
        console.error('VC Command Error:', error);

        return message.channel.send(
            '❌ Something went wrong.'
        );
    }
});

// =========================
// LOGIN
// =========================

client.login('YOUR_BOT_TOKEN');
