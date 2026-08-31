// ============================================================
// TITAN BOT - ALL-IN-ONE BOT.JS
// discord.js v14
// Prefix: -
// ============================================================

const {
    Client,
    GatewayIntentBits,
    Partials,
    ChannelType,
    PermissionFlagsBits,
    Collection
} = require("discord.js");

// ============================================================
// CONFIG
// ============================================================

const TOKEN = process.env.DISCORD_TOKEN || "YOUR_BOT_TOKEN_HERE";
const PREFIX = "-";

// Role names.
// CHANGE THESE TO YOUR ACTUAL ROLE NAMES.
const ROLES = {
    FOUNDER: "Founder",
    GOD: "God",
    OWNER: "Owner",
    ADMIN: "Admin",
    MODERATOR: "Moderator",
    HELPER: "Helper"
};

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.GuildMember,
        Partials.User,
        Partials.Channel
    ]
});

// ============================================================
// DATABASE / MEMORY
// ============================================================

/*
    Everything is stored in memory here.

    IMPORTANT:
    If the bot restarts, these settings disappear.

    For a real production bot, replace this with
    SQLite / MongoDB / PostgreSQL.
*/

const guildData = new Map();

/*
guildData:

guildId => {
    triggerChannelId,
    categoryId,
    nameTemplate,
    userLimit,
    bitrate,

    temporaryChannels: Map(),

    stfuUsers: Set(),

    foreverBannedUsers: Set()
}
*/

// ============================================================
// DEFAULT GUILD DATA
// ============================================================

function getGuildData(guildId) {

    if (!guildData.has(guildId)) {

        guildData.set(guildId, {
            triggerChannelId: null,

            categoryId: null,

            nameTemplate: "{username}'s Room",

            userLimit: 0,

            bitrate: 64000,

            temporaryChannels: new Map(),

            stfuUsers: new Set(),

            foreverBannedUsers: new Set()
        });

    }

    return guildData.get(guildId);
}

// ============================================================
// ROLE CHECKS
// ============================================================

function hasRole(member, roleName) {

    if (!member) return false;

    return member.roles.cache.some(
        role =>
            role.name.toLowerCase() ===
            roleName.toLowerCase()
    );
}

function isServerOwner(member) {

    return member.guild.ownerId === member.id;
}

function isFounder(member) {

    return (
        isServerOwner(member) ||
        hasRole(member, ROLES.FOUNDER)
    );
}

function isGod(member) {

    return (
        isServerOwner(member) ||
        isFounder(member) ||
        hasRole(member, ROLES.GOD)
    );
}

function isOwner(member) {

    return (
        isGod(member) ||
        hasRole(member, ROLES.OWNER)
    );
}

function isAdmin(member) {

    return (
        isOwner(member) ||
        hasRole(member, ROLES.ADMIN)
    );
}

function isModerator(member) {

    return (
        isAdmin(member) ||
        hasRole(member, ROLES.MODERATOR)
    );
}

function isHelper(member) {

    return (
        isModerator(member) ||
        hasRole(member, ROLES.HELPER)
    );
}

// ============================================================
// VC PERMISSION CHECK
// ============================================================

function isVCOwner(member, channel) {

    const data =
        getGuildData(member.guild.id);

    const vc =
        data.temporaryChannels.get(channel.id);

    if (!vc) return false;

    return vc.ownerId === member.id;
}

function canManageVC(member, channel) {

    return (
        isServerOwner(member) ||
        isFounder(member) ||
        isGod(member) ||
        isVCOwner(member, channel)
    );
}

// ============================================================
// NAME FORMAT
// ============================================================

function formatVCName(member, template) {

    return template
        .replaceAll(
            "{username}",
            member.user.username
        )
        .replaceAll(
            "{displayName}",
            member.displayName ||
            member.user.globalName ||
            member.user.username
        );
}

// ============================================================
// READY
// ============================================================

client.once("ready", () => {

    console.log("=================================");
    console.log("TITAN BOT ONLINE");
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Prefix: ${PREFIX}`);
    console.log("=================================");

    client.user.setActivity("-help", {
        type: 0
    });
});

// ============================================================
// VOICE STATE UPDATE
// ============================================================

client.on(
    "voiceStateUpdate",
    async (oldState, newState) => {

        try {

            const guild =
                newState.guild ||
                oldState.guild;

            if (!guild) return;

            const data =
                getGuildData(guild.id);

            // ------------------------------------------------
            // STFU PROTECTION
            // ------------------------------------------------

            if (
                newState.member &&
                data.stfuUsers.has(
                    newState.member.id
                )
            ) {

                if (
                    newState.serverMute === false &&
                    newState.channel
                ) {

                    if (
                        guild.members.me?.permissions.has(
                            PermissionFlagsBits.MuteMembers
                        )
                    ) {

                        await newState.member.voice
                            .setMute(
                                true,
                                "STFU protection"
                            )
                            .catch(() => {});
                    }
                }
            }

            // ------------------------------------------------
            // LEFT TEMP VC
            // ------------------------------------------------

            if (
                oldState.channel &&
                oldState.channelId !==
                newState.channelId
            ) {

                await cleanupVC(
                    oldState.channel
                );
            }

            // ------------------------------------------------
            // JOINED TRIGGER
            // ------------------------------------------------

            if (
                newState.channel &&
                newState.channelId ===
                data.triggerChannelId
            ) {

                await createTemporaryVC(
                    newState.member
                );
            }

        } catch (error) {

            console.error(
                "VoiceState Error:",
                error
            );
        }
    }
);

// ============================================================
// CREATE TEMPORARY VC
// ============================================================

async function createTemporaryVC(member) {

    const guild =
        member.guild;

    const data =
        getGuildData(guild.id);

    // Don't create if configuration is missing.
    if (!data.triggerChannelId) return;

    const channelName =
        formatVCName(
            member,
            data.nameTemplate
        );

    // ------------------------------------------------
    // CREATE CHANNEL
    // ------------------------------------------------

    const channel =
        await guild.channels.create({

            name: channelName,

            type: ChannelType.GuildVoice,

            parent:
                data.categoryId || null,

            bitrate:
                data.bitrate || 64000,

            userLimit:
                data.userLimit || 0,

            permissionOverwrites: [

                {
                    id: guild.id,

                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect
                    ]
                }

            ]
        });

    // ------------------------------------------------
    // REGISTER VC
    // ------------------------------------------------

    data.temporaryChannels.set(
        channel.id,
        {
            ownerId: member.id,

            bannedUsers: new Set(),

            rejectedUsers: new Set()
        }
    );

    // ------------------------------------------------
    // MOVE USER
    // ------------------------------------------------

    await member.voice
        .setChannel(
            channel,
            "Join to Create"
        )
        .catch(async () => {

            // If movement failed and nobody
            // is inside, remove the channel.

            if (channel.members.size === 0) {

                data.temporaryChannels
                    .delete(channel.id);

                await channel
                    .delete()
                    .catch(() => {});
            }

        });
}

// ============================================================
// CLEANUP VC
// ============================================================

async function cleanupVC(channel) {

    const guild =
        channel.guild;

    const data =
        getGuildData(guild.id);

    const vc =
        data.temporaryChannels
            .get(channel.id);

    if (!vc) return;

    // ------------------------------------------------
    // PEOPLE STILL INSIDE
    // ------------------------------------------------

    if (channel.members.size > 0) {

        // Owner left.
        // Transfer ownership.

        if (
            !channel.members.has(
                vc.ownerId
            )
        ) {

            const newOwner =
                channel.members.first();

            if (newOwner) {

                vc.ownerId =
                    newOwner.id;

                // Update permissions if desired.
                await channel.permissionOverwrites
                    .edit(
                        newOwner.id,
                        {
                            ViewChannel: true,
                            Connect: true,
                            Speak: true
                        }
                    )
                    .catch(() => {});
            }
        }

        return;
    }

    // ------------------------------------------------
    // EMPTY
    // ------------------------------------------------

    data.temporaryChannels
        .delete(channel.id);

    await channel
        .delete(
            "Temporary VC became empty"
        )
        .catch(() => {});
}

// ============================================================
// MESSAGE CREATE
// ============================================================

client.on(
    "messageCreate",
    async message => {

        try {

            if (message.author.bot) return;

            if (!message.guild) return;

            if (
                !message.content.startsWith(
                    PREFIX
                )
            ) return;

            const args =
                message.content
                    .slice(PREFIX.length)
                    .trim()
                    .split(/\s+/);

            const command =
                args
                    .shift()
                    ?.toLowerCase();

            if (!command) return;

            // =================================================
            // HELP
            // =================================================

            if (command === "help") {

                return sendHelp(message);
            }

            // =================================================
            // PING
            // =================================================

            if (command === "ping") {

                return message.reply(
                    `🏓 Pong! ${client.ws.ping}ms`
                );
            }

            // =================================================
            // BOT INFO
            // =================================================

            if (command === "botinfo") {

                return message.reply({
                    content: [
                        "**Titan Bot**",
                        "",
                        `Servers: ${client.guilds.cache.size}`,
                        `Users: ${client.users.cache.size}`,
                        `Ping: ${client.ws.ping}ms`,
                        `Prefix: \`${PREFIX}\``
                    ].join("\n")
                });
            }

            // =================================================
            // SERVER INFO
            // =================================================

            if (command === "serverinfo") {

                const guild =
                    message.guild;

                return message.reply({
                    content: [
                        `**${guild.name}**`,
                        "",
                        `Owner: <@${guild.ownerId}>`,
                        `Members: ${guild.memberCount}`,
                        `Channels: ${guild.channels.cache.size}`,
                        `Roles: ${guild.roles.cache.size}`
                    ].join("\n")
                });
            }

            // =================================================
            // USER INFO
            // =================================================

            if (command === "userinfo") {

                const target =
                    message.mentions.members.first() ||
                    message.member;

                return message.reply({
                    content: [
                        `**${target.user.tag}**`,
                        "",
                        `ID: ${target.id}`,
                        `Joined: <t:${Math.floor(target.joinedTimestamp / 1000)}:R>`,
                        `Roles: ${target.roles.cache.size - 1}`
                    ].join("\n")
                });
            }

            // =================================================
            // AVATAR
            // =================================================

            if (command === "avatar") {

                const target =
                    message.mentions.users.first() ||
                    message.author;

                return message.reply(
                    target.displayAvatarURL({
                        size: 1024
                    })
                );
            }

            // =================================================
            // VC COMMAND
            // =================================================

            if (command === "vc") {

                return handleVCCommand(
                    message,
                    args
                );
            }

            // =================================================
            // KICK
            // =================================================

            if (command === "kick") {

                return handleKick(
                    message,
                    args
                );
            }

            // =================================================
            // BAN
            // =================================================

            if (command === "ban") {

                return handleBan(
                    message,
                    args,
                    false
                );
            }

            // =================================================
            // FOREVER BAN
            // =================================================

            if (
                command ===
                "foreverban"
            ) {

                return handleBan(
                    message,
                    args,
                    true
                );
            }

            // =================================================
            // UNBAN
            // =================================================

            if (command === "unban") {

                return handleUnban(
                    message,
                    args
                );
            }

            // =================================================
            // WARN
            // =================================================

            if (command === "warn") {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You don't have permission to use `-warn`."
                    );
                }

                const target =
                    message.mentions.members.first();

                if (!target) {

                    return message.reply(
                        "Usage: `-warn @user reason`"
                    );
                }

                const reason =
                    args
                        .slice(1)
                        .join(" ") ||
                    "No reason provided";

                return message.reply(
                    `⚠️ ${target} was warned.\nReason: ${reason}`
                );
            }

            // =================================================
            // TIMEOUT
            // =================================================

            if (command === "timeout") {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You don't have permission to use `-timeout`."
                    );
                }

                const target =
                    message.mentions.members.first();

                const minutes =
                    parseInt(args[1]) || 10;

                if (!target) {

                    return message.reply(
                        "Usage: `-timeout @user 10`"
                    );
                }

                if (!target.moderatable) {

                    return message.reply(
                        "❌ I can't timeout that user."
                    );
                }

                await target.timeout(
                    minutes * 60 * 1000,
                    `Timeout by ${message.author.tag}`
                );

                return message.reply(
                    `⏱️ ${target} timed out for ${minutes} minutes.`
                );
            }

            // =================================================
            // UNTIMEOUT
            // =================================================

            if (
                command ===
                "untimeout"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You don't have permission."
                    );
                }

                const target =
                    message.mentions.members.first();

                if (!target) {

                    return message.reply(
                        "Usage: `-untimeout @user`"
                    );
                }

                await target.timeout(
                    null,
                    `Timeout removed by ${message.author.tag}`
                );

                return message.reply(
                    `✅ Timeout removed from ${target}.`
                );
            }

            // =================================================
            // CLEAR
            // =================================================

            if (command === "clear") {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You don't have permission."
                    );
                }

                const amount =
                    parseInt(args[0]);

                if (
                    !amount ||
                    amount < 1 ||
                    amount > 100
                ) {

                    return message.reply(
                        "Usage: `-clear 1-100`"
                    );
                }

                const deleted =
                    await message.channel
                        .bulkDelete(
                            amount,
                            true
                        );

                return message.channel
                    .send(
                        `🧹 Deleted ${deleted.size} messages.`
                    )
                    .then(msg => {

                        setTimeout(
                            () =>
                                msg.delete()
                                    .catch(() => {}),
                            3000
                        );

                    });
            }

            // =================================================
            // LOCK
            // =================================================

            if (command === "lock") {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You don't have permission."
                    );
                }

                await message.channel
                    .permissionOverwrites
                    .edit(
                        message.guild.id,
                        {
                            SendMessages: false
                        }
                    );

                return message.reply(
                    "🔒 Channel locked."
                );
            }

            // =================================================
            // UNLOCK
            // =================================================

            if (command === "unlock") {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You don't have permission."
                    );
                }

                await message.channel
                    .permissionOverwrites
                    .edit(
                        message.guild.id,
                        {
                            SendMessages: null
                        }
                    );

                return message.reply(
                    "🔓 Channel unlocked."
                );
            }

            // =================================================
            // SLOWMODE
            // =================================================

            if (
                command ===
                "slowmode"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You don't have permission."
                    );
                }

                const seconds =
                    parseInt(args[0]);

                if (
                    isNaN(seconds) ||
                    seconds < 0 ||
                    seconds > 21600
                ) {

                    return message.reply(
                        "Usage: `-slowmode 0-21600`"
                    );
                }

                await message.channel
                    .setRateLimitPerUser(
                        seconds
                    );

                return message.reply(
                    `🐌 Slowmode set to ${seconds} seconds.`
                );
            }

        } catch (error) {

            console.error(
                "Command Error:",
                error
            );

            await message.reply(
                "❌ An error occurred while running that command."
            ).catch(() => {});
        }
    }
);

// ============================================================
// VC COMMAND HANDLER
// ============================================================

async function handleVCCommand(
    message,
    args
) {

    const action =
        args[0]?.toLowerCase();

    // --------------------------------------------------------
    // HELP
    // --------------------------------------------------------

    if (
        !action ||
        action === "help"
    ) {

        return message.reply({
            content: [
                "**🎙️ VC COMMANDS**",
                "",
                "`-vc setup`",
                "Setup the entire Join to Create system.",
                "",
                "`-vc owner`",
                "Show the owner of your VC.",
                "",
                "`-vc kick @user`",
                "Kick someone from your VC.",
                "",
                "`-vc reject @user`",
                "Reject someone from your VC.",
                "",
                "`-vc ban @user`",
                "Ban someone from your VC.",
                "",
                "`-vc unban @user`",
                "Remove a VC ban.",
                "",
                "`-vc stfu @user`",
                "Force server mute someone.",
                "",
                "`-vc unstfu @user`",
                "Remove STFU protection."
            ].join("\n")
        });
    }

    // --------------------------------------------------------
    // SETUP
    // --------------------------------------------------------

    if (action === "setup") {

        if (
            !isServerOwner(
                message.member
            ) &&
            !hasRole(
                message.member,
                ROLES.FOUNDER
            )
        ) {

            return message.reply(
                "❌ Only the **Server Owner** or **Founder** can setup JTC."
            );
        }

        const data =
            getGuildData(
                message.guild.id
            );

        if (data.triggerChannelId) {

            const existing =
                message.guild.channels.cache.get(
                    data.triggerChannelId
                );

            if (existing) {

                return message.reply(
                    `❌ JTC is already setup: ${existing}`
                );
            }
        }

        // ----------------------------------------------------
        // CREATE CATEGORY
        // ----------------------------------------------------

        const category =
            await message.guild.channels.create({

                name: "Voice Channels",

                type:
                    ChannelType.GuildCategory
            });

        // ----------------------------------------------------
        // CREATE TRIGGER
        // ----------------------------------------------------

        const trigger =
            await message.guild.channels.create({

                name: "➕ Join To Create",

                type:
                    ChannelType.GuildVoice,

                parent:
                    category.id,

                permissionOverwrites: [

                    {
                        id:
                            message.guild.id,

                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect
                        ]
                    }

                ]
            });

        // ----------------------------------------------------
        // SAVE
        // ----------------------------------------------------

        data.triggerChannelId =
            trigger.id;

        data.categoryId =
            category.id;

        data.nameTemplate =
            "{username}'s Room";

        data.userLimit =
            0;

        data.bitrate =
            64000;

        return message.reply({
            content: [
                "✅ **JOIN TO CREATE SETUP COMPLETE**",
                "",
                `📁 Category: ${category}`,
                `🎙️ Trigger: ${trigger}`,
                "",
                "Members can join the trigger and automatically receive their own VC.",
                "",
                "**Default VC:**",
                "`{username}'s Room`",
                "",
                "**Limit:** Unlimited",
                "**Bitrate:** 64kbps"
            ].join("\n")
        });
    }

    // --------------------------------------------------------
    // USER MUST BE IN VC
    // --------------------------------------------------------

    const channel =
        message.member.voice.channel;

    if (!channel) {

        return message.reply(
            "❌ You must be inside a temporary VC."
        );
    }

    const data =
        getGuildData(
            message.guild.id
        );

    const vc =
        data.temporaryChannels
            .get(channel.id);

    if (!vc) {

        return message.reply(
            "❌ This isn't a Join to Create VC."
        );
    }

    // --------------------------------------------------------
    // OWNER
    // --------------------------------------------------------

    if (action === "owner") {

        return message.reply(
            `👑 VC Owner: <@${vc.ownerId}>`
        );
    }

    // --------------------------------------------------------
    // VC MANAGER
    // --------------------------------------------------------

    if (
        !canManageVC(
            message.member,
            channel
        )
    ) {

        return message.reply(
            "❌ Only the **VC Owner**, **God**, **Founder**, or **Server Owner** can manage this VC."
        );
    }

    const target =
        message.mentions.members.first();

    // --------------------------------------------------------
    // VC KICK
    // --------------------------------------------------------

    if (action === "kick") {

        if (!target) {

            return message.reply(
                "Usage: `-vc kick @user`"
            );
        }

        if (
            !channel.members.has(
                target.id
            )
        ) {

            return message.reply(
                "❌ That user isn't in your VC."
            );
        }

        if (
            !message.guild.members.me.permissions
                .has(
                    PermissionFlagsBits.MoveMembers
                )
        ) {

            return message.reply(
                "❌ I need **Move Members** permission."
            );
        }

        await target.voice.disconnect(
            `VC kick by ${message.author.tag}`
        );

        return message.reply(
            `🚪 ${target} was kicked from the VC.`
        );
    }

    // --------------------------------------------------------
    // VC REJECT
    // --------------------------------------------------------

    if (action === "reject") {

        if (!target) {

            return message.reply(
                "Usage: `-vc reject @user`"
            );
        }

        vc.rejectedUsers.add(
            target.id
        );

        await channel.permissionOverwrites.edit(
            target.id,
            {
                Connect: false
            }
        );

        if (
            target.voice.channelId ===
            channel.id
        ) {

            await target.voice
                .disconnect(
                    "Rejected from VC"
                )
                .catch(() => {});
        }

        return message.reply(
            `🚫 ${target} was rejected from this VC.`
        );
    }

    // --------------------------------------------------------
    // VC BAN
    // --------------------------------------------------------

    if (action === "ban") {

        if (!target) {

            return message.reply(
                "Usage: `-vc ban @user`"
            );
        }

        vc.bannedUsers.add(
            target.id
        );

        await channel.permissionOverwrites.edit(
            target.id,
            {
                ViewChannel: false,
                Connect: false
            }
        );

        if (
            target.voice.channelId ===
            channel.id
        ) {

            await target.voice
                .disconnect(
                    "Banned from VC"
                )
                .catch(() => {});
        }

        return message.reply(
            `🔨 ${target} was banned from this VC.`
        );
    }

    // --------------------------------------------------------
    // VC UNBAN
    // --------------------------------------------------------

    if (action === "unban") {

        if (!target) {

            return message.reply(
                "Usage: `-vc unban @user`"
            );
        }

        vc.bannedUsers.delete(
            target.id
        );

        await channel.permissionOverwrites
            .delete(
                target.id
            )
            .catch(() => {});

        return message.reply(
            `✅ ${target} was unbanned from this VC.`
        );
    }

    // --------------------------------------------------------
    // VC STFU
    // --------------------------------------------------------

    if (action === "stfu") {

        if (!target) {

            return message.reply(
                "Usage: `-vc stfu @user`"
            );
        }

        if (
            !message.guild.members.me.permissions
                .has(
                    PermissionFlagsBits.MuteMembers
                )
        ) {

            return message.reply(
                "❌ I need **Mute Members** permission."
            );
        }

        data.stfuUsers.add(
            target.id
        );

        if (
            target.voice.channel
        ) {

            await target.voice
                .setMute(
                    true,
                    `STFU by ${message.author.tag}`
                )
                .catch(() => {});
        }

        return message.reply(
            `🔇 ${target} is now **STFU protected**.`
        );
    }

    // --------------------------------------------------------
    // VC UNSTFU
    // --------------------------------------------------------

    if (
        action === "unstfu"
    ) {

        if (!target) {

            return message.reply(
                "Usage: `-vc unstfu @user`"
            );
        }

        if (
            !isServerOwner(
                message.member
            ) &&
            !isFounder(
                message.member
            ) &&
            !isGod(
                message.member
            )
        ) {

            return message.reply(
                "❌ Only **Founder**, **God**, or the **Server Owner** can remove STFU protection."
            );
        }

        data.stfuUsers.delete(
            target.id
        );

        if (
            target.voice.channel
        ) {

            await target.voice
                .setMute(
                    false,
                    `STFU removed by ${message.author.tag}`
                )
                .catch(() => {});
        }

        return message.reply(
            `🔊 ${target} is no longer STFU protected.`
        );
    }

    return message.reply(
        "❌ Unknown VC command. Use `-vc help`."
    );
}

// ============================================================
// KICK
// ============================================================

async function handleKick(
    message,
    args
) {

    if (
        !isModerator(
            message.member
        )
    ) {

        return message.reply(
            "❌ You don't have permission to use `-kick`."
        );
    }

    const target =
        message.mentions.members.first();

    if (!target) {

        return message.reply(
            "Usage: `-kick @user reason`"
        );
    }

    if (
        target.id ===
        message.author.id
    ) {

        return message.reply(
            "❌ You can't kick yourself."
        );
    }

    if (!target.kickable) {

        return message.reply(
            "❌ I can't kick that user. Check role hierarchy."
        );
    }

    const reason =
        args
            .slice(1)
            .join(" ") ||
        "No reason provided";

    await target.kick(
        `${reason} | ${message.author.tag}`
    );

    return message.reply(
        `👢 **${target.user.tag}** was kicked.`
    );
}

// ============================================================
// BAN / FOREVERBAN
// ============================================================

async function handleBan(
    message,
    args,
    forever
) {

    // --------------------------------------------------------
    // FOREVERBAN
    // --------------------------------------------------------

    if (forever) {

        if (
            !isServerOwner(
                message.member
            ) &&
            !hasRole(
                message.member,
                ROLES.FOUNDER
            ) &&
            !hasRole(
                message.member,
                ROLES.GOD
            )
        ) {

            return message.reply(
                "❌ Only **Server Owner**, **Founder**, or **God** can use `-foreverban`."
            );
        }

    } else {

        // ----------------------------------------------------
        // NORMAL BAN
        // ----------------------------------------------------

        if (
            !isOwner(
                message.member
            )
        ) {

            return message.reply(
                "❌ You don't have permission to use `-ban`."
            );
        }
    }

    const target =
        message.mentions.members.first();

    if (!target) {

        return message.reply(
            forever
                ? "Usage: `-foreverban @user reason`"
                : "Usage: `-ban @user reason`"
        );
    }

    if (
        target.id ===
        message.author.id
    ) {

        return message.reply(
            "❌ You can't ban yourself."
        );
    }

    if (!target.bannable) {

        return message.reply(
            "❌ I can't ban that user. Check role hierarchy."
        );
    }

    const reason =
        args
            .slice(1)
            .join(" ") ||
        "No reason provided";

    const data =
        getGuildData(
            message.guild.id
        );

    if (forever) {

        data.foreverBannedUsers.add(
            target.id
        );
    }

    await target.ban({

        deleteMessageSeconds: 0,

        reason:
            `${forever ? "[FOREVERBAN] " : ""}${reason} | ${message.author.tag}`
    });

    return message.reply({
        content: forever
            ? [
                "⛔ **FOREVERBAN COMPLETE**",
                "",
                `User: **${target.user.tag}**`,
                `Moderator: **${message.author.tag}**`,
                `Reason: **${reason}**`,
                "",
                "The user is permanently banned until manually unbanned."
            ].join("\n")
            : `🔨 **${target.user.tag}** was banned.`
    });
}

// ============================================================
// UNBAN
// ============================================================

async function handleUnban(
    message,
    args
) {

    if (
        !isOwner(
            message.member
        )
    ) {

        return message.reply(
            "❌ You don't have permission to use `-unban`."
        );
    }

    const userId =
        args[0];

    if (!userId) {

        return message.reply(
            "Usage: `-unban USER_ID`"
        );
    }

    await message.guild.members
        .unban(
            userId,
            `Unbanned by ${message.author.tag}`
        )
        .catch(() => null);

    const data =
        getGuildData(
            message.guild.id
        );

    data.foreverBannedUsers.delete(
        userId
    );

    return message.reply(
        `✅ <@${userId}> has been unbanned.`
    );
}

// ============================================================
// HELP
// ============================================================

async function sendHelp(message) {

    const help = [
        "╔══════════════════════════════╗",
        "        **TITAN BOT HELP**",
        "╚══════════════════════════════╝",
        "",
        "**🎙️ VOICE**",
        "`-vc setup`",
        "`-vc help`",
        "`-vc owner`",
        "`-vc kick @user`",
        "`-vc reject @user`",
        "`-vc ban @user`",
        "`-vc unban @user`",
        "`-vc stfu @user`",
        "`-vc unstfu @user`",
        "",
        "**🛡️ MODERATION**",
        "`-kick @user`",
        "`-ban @user`",
        "`-foreverban @user`",
        "`-unban USER_ID`",
        "`-warn @user`",
        "`-timeout @user 10`",
        "`-untimeout @user`",
        "`-clear 10`",
        "`-lock`",
        "`-unlock`",
        "`-slowmode 5`",
        "",
        "**⚙️ GENERAL**",
        "`-ping`",
        "`-serverinfo`",
        "`-userinfo @user`",
        "`-avatar @user`",
        "`-botinfo`",
        "",
        "**👑 RANKS**",
        "`Founder` — Highest staff access",
        "`God` — High-level moderation",
        "`Owner` — Server moderation",
        "`Admin` — Administration",
        "`Moderator` — Moderation",
        "`Helper` — Basic staff"
    ];

    return message.reply({
        content: help.join("\n")
    });
}

// ============================================================
// LOGIN
// ============================================================

client.login(MTU0NDEwMTE2OTI4OTIzMjQ0Ng.Gsz7IB.rvyd7fu7ppetH_itjGhAqJoBWISZvINa-3yEjo);
