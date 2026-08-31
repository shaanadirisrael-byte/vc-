require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

// ============================================================
// CONFIG
// ============================================================

const PREFIX = "-";

// EXACT ROLE NAMES
// Change these if your server uses different names.
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
// MEMORY DATABASE
// ============================================================

const guildData = new Map();

/*
    guildData structure:

    guildId: {
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
// GET GUILD DATA
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

// ============================================================
// SERVER OWNER
// ============================================================

function isServerOwner(member) {

    if (!member || !member.guild) {
        return false;
    }

    return member.id === member.guild.ownerId;
}

// ============================================================
// FOUNDER
// ============================================================

function isFounder(member) {

    return (
        isServerOwner(member) ||
        hasRole(member, ROLES.FOUNDER)
    );
}

// ============================================================
// GOD
// ============================================================

function isGod(member) {

    return (
        isFounder(member) ||
        hasRole(member, ROLES.GOD)
    );
}

// ============================================================
// OWNER
// ============================================================

function isOwner(member) {

    return (
        isGod(member) ||
        hasRole(member, ROLES.OWNER)
    );
}

// ============================================================
// ADMIN
// ============================================================

function isAdmin(member) {

    return (
        isOwner(member) ||
        hasRole(member, ROLES.ADMIN)
    );
}

// ============================================================
// MODERATOR
// ============================================================

function isModerator(member) {

    return (
        isAdmin(member) ||
        hasRole(member, ROLES.MODERATOR)
    );
}

// ============================================================
// HELPER
// ============================================================

function isHelper(member) {

    return (
        isModerator(member) ||
        hasRole(member, ROLES.HELPER)
    );
}

// ============================================================
// HIGH COMMAND
// ============================================================

function isHighCommand(member) {

    return (
        isServerOwner(member) ||
        isFounder(member) ||
        isGod(member)
    );
}

// ============================================================
// VC OWNER
// ============================================================

function getTemporaryVC(member) {

    if (!member.voice.channel) {
        return null;
    }

    const data =
        getGuildData(member.guild.id);

    return data.temporaryChannels.get(
        member.voice.channel.id
    ) || null;
}

// ============================================================
// CAN MANAGE VC
// ============================================================

function canManageVC(member, channel) {

    const data =
        getGuildData(member.guild.id);

    const vc =
        data.temporaryChannels.get(channel.id);

    if (!vc) {
        return false;
    }

    return (
        isServerOwner(member) ||
        isFounder(member) ||
        isGod(member) ||
        vc.ownerId === member.id
    );
}

// ============================================================
// FORMAT VC NAME
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
// BOT PERMISSION CHECK
// ============================================================

function botHasPermission(
    guild,
    permission
) {

    const bot =
        guild.members.me;

    if (!bot) {
        return false;
    }

    return bot.permissions.has(
        permission
    );
}

// ============================================================
// READY
// ============================================================

client.once("ready", () => {

    console.log("");
    console.log("====================================");
    console.log("        TITAN BOT ONLINE");
    console.log("====================================");
    console.log(`Bot: ${client.user.tag}`);
    console.log(`Servers: ${client.guilds.cache.size}`);
    console.log(`Prefix: ${PREFIX}`);
    console.log("====================================");
    console.log("");

    client.user.setActivity(
        "-help",
        {
            type: 0
        }
    );
});

// ============================================================
// GUILD MEMBER ADD
// ============================================================

client.on(
    "guildMemberAdd",
    async member => {

        const data =
            getGuildData(
                member.guild.id
            );

        // Check forever ban list.
        if (
            data.foreverBannedUsers
                .has(member.id)
        ) {

            await member.ban({

                deleteMessageSeconds: 0,

                reason:
                    "Foreverban protection"
            }).catch(() => {});

            return;
        }
    }
);

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

            if (!guild) {
                return;
            }

            const data =
                getGuildData(
                    guild.id
                );

            // =================================================
            // STFU PROTECTION
            // =================================================

            if (
                newState.member &&
                newState.channel
            ) {

                const member =
                    newState.member;

                // ------------------------------------------------
                // STFU USERS CAN NEVER UNMUTE THEMSELVES
                // ------------------------------------------------

                if (
                    data.stfuUsers.has(
                        member.id
                    )
                ) {

                    if (
                        !newState.serverMute
                    ) {

                        if (
                            botHasPermission(
                                guild,
                                PermissionFlagsBits.MuteMembers
                            )
                        ) {

                            await member.voice
                                .setMute(
                                    true,
                                    "STFU protection"
                                )
                                .catch(() => {});
                        }
                    }
                }

                // ------------------------------------------------
                // FOUNDER/GOD GODMODE
                // ------------------------------------------------

                if (
                    isHighCommand(member) &&
                    newState.serverMute
                ) {

                    if (
                        botHasPermission(
                            guild,
                            PermissionFlagsBits.MuteMembers
                        )
                    ) {

                        await member.voice
                            .setMute(
                                false,
                                "High command godmode"
                            )
                            .catch(() => {});
                    }
                }
            }

            // =================================================
            // LEFT A TEMPORARY VC
            // =================================================

            if (
                oldState.channel &&
                oldState.channelId !==
                newState.channelId
            ) {

                await handleVCOwnerLeave(
                    oldState.channel
                );

                await cleanupVC(
                    oldState.channel
                );
            }

            // =================================================
            // JOINED TRIGGER
            // =================================================

            if (
                newState.channel &&
                newState.channelId ===
                data.triggerChannelId
            ) {

                await createTemporaryVC(
                    newState.member
                );
            }

            // =================================================
            // VC BAN/REJECT PROTECTION
            // =================================================

            if (
                newState.channel
            ) {

                const vc =
                    data.temporaryChannels
                        .get(
                            newState.channel.id
                        );

                if (vc) {

                    if (
                        vc.bannedUsers
                            .has(
                                newState.member.id
                            )
                    ) {

                        await newState.member
                            .voice
                            .disconnect(
                                "Banned from temporary VC"
                            )
                            .catch(() => {});

                        return;
                    }

                    if (
                        vc.rejectedUsers
                            .has(
                                newState.member.id
                            )
                    ) {

                        await newState.member
                            .voice
                            .disconnect(
                                "Rejected from temporary VC"
                            )
                            .catch(() => {});

                        return;
                    }
                }
            }

        } catch (error) {

            console.error(
                "[VOICE ERROR]",
                error
            );
        }
    }
);

// ============================================================
// CREATE TEMP VC
// ============================================================

async function createTemporaryVC(
    member
) {

    if (!member) {
        return;
    }

    const guild =
        member.guild;

    const data =
        getGuildData(
            guild.id
        );

    if (!data.triggerChannelId) {
        return;
    }

    // --------------------------------------------------------
    // MAKE SURE THEY ARE NOT ALREADY IN A TEMP VC
    // --------------------------------------------------------

    if (
        data.temporaryChannels
            .has(
                member.voice.channelId
            )
    ) {

        return;
    }

    // --------------------------------------------------------
    // CREATE NAME
    // --------------------------------------------------------

    const name =
        formatVCName(
            member,
            data.nameTemplate
        );

    // --------------------------------------------------------
    // CREATE CHANNEL
    // --------------------------------------------------------

    let channel;

    try {

        channel =
            await guild.channels.create({

                name,

                type:
                    ChannelType.GuildVoice,

                parent:
                    data.categoryId ||
                    null,

                bitrate:
                    data.bitrate,

                userLimit:
                    data.userLimit,

                permissionOverwrites: [

                    {
                        id:
                            guild.id,

                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak
                        ]
                    }

                ]

            });

    } catch (error) {

        console.error(
            "Could not create VC:",
            error
        );

        return;
    }

    // --------------------------------------------------------
    // REGISTER
    // --------------------------------------------------------

    data.temporaryChannels.set(
        channel.id,
        {

            ownerId:
                member.id,

            bannedUsers:
                new Set(),

            rejectedUsers:
                new Set()

        }
    );

    // --------------------------------------------------------
    // MOVE USER
    // --------------------------------------------------------

    try {

        await member.voice.setChannel(
            channel,
            "Join to Create"
        );

    } catch (error) {

        console.error(
            "Could not move member:",
            error
        );

        data.temporaryChannels.delete(
            channel.id
        );

        await channel.delete()
            .catch(() => {});
    }
}

// ============================================================
// VC OWNER LEAVE
// ============================================================

async function handleVCOwnerLeave(
    channel
) {

    if (!channel) {
        return;
    }

    const data =
        getGuildData(
            channel.guild.id
        );

    const vc =
        data.temporaryChannels
            .get(channel.id);

    if (!vc) {
        return;
    }

    // If owner is still inside, nothing.
    if (
        channel.members.has(
            vc.ownerId
        )
    ) {

        return;
    }

    // --------------------------------------------------------
    // OWNER LEFT
    // --------------------------------------------------------

    if (
        channel.members.size > 0
    ) {

        const newOwner =
            channel.members.first();

        if (!newOwner) {
            return;
        }

        vc.ownerId =
            newOwner.id;

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

// ============================================================
// CLEAN EMPTY VC
// ============================================================

async function cleanupVC(
    channel
) {

    if (!channel) {
        return;
    }

    const data =
        getGuildData(
            channel.guild.id
        );

    const vc =
        data.temporaryChannels
            .get(channel.id);

    if (!vc) {
        return;
    }

    // Do not delete if users remain.
    if (
        channel.members.size > 0
    ) {

        return;
    }

    data.temporaryChannels.delete(
        channel.id
    );

    await channel.delete(
        "Temporary VC became empty"
    ).catch(() => {});
}

// ============================================================
// MESSAGE CREATE
// ============================================================

client.on(
    "messageCreate",
    async message => {

        try {

            if (
                message.author.bot
            ) {
                return;
            }

            if (
                !message.guild
            ) {
                return;
            }

            if (
                !message.content
                    .startsWith(PREFIX)
            ) {
                return;
            }

            const args =
                message.content
                    .slice(PREFIX.length)
                    .trim()
                    .split(/\s+/);

            const command =
                args
                    .shift()
                    ?.toLowerCase();

            if (!command) {
                return;
            }

            // =================================================
            // HELP
            // =================================================

            if (
                command === "help"
            ) {

                return sendHelp(
                    message
                );
            }

            // =================================================
            // PING
            // =================================================

            if (
                command === "ping"
            ) {

                return message.reply(
                    `🏓 Pong! ${client.ws.ping}ms`
                );
            }

            // =================================================
            // BOT INFO
            // =================================================

            if (
                command === "botinfo"
            ) {

                return message.reply({

                    content: [
                        "**TITAN BOT**",
                        "",
                        `Bot: ${client.user.tag}`,
                        `Servers: ${client.guilds.cache.size}`,
                        `Ping: ${client.ws.ping}ms`,
                        `Prefix: ${PREFIX}`
                    ].join("\n")

                });
            }

            // =================================================
            // SERVER INFO
            // =================================================

            if (
                command === "serverinfo"
            ) {

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

            if (
                command === "userinfo"
            ) {

                const target =
                    message.mentions.members.first() ||
                    message.member;

                return message.reply({

                    content: [
                        `**${target.user.tag}**`,
                        "",
                        `ID: ${target.id}`,
                        `Joined: <t:${Math.floor(target.joinedTimestamp / 1000)}:R>`,
                        `Roles: ${Math.max(target.roles.cache.size - 1, 0)}`
                    ].join("\n")

                });
            }

            // =================================================
            // AVATAR
            // =================================================

            if (
                command === "avatar"
            ) {

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
            // VC
            // =================================================

            if (
                command === "vc"
            ) {

                return handleVCCommand(
                    message,
                    args
                );
            }

            // =================================================
            // KICK
            // =================================================

            if (
                command === "kick"
            ) {

                return handleKick(
                    message,
                    args
                );
            }

            // =================================================
            // BAN
            // =================================================

            if (
                command === "ban"
            ) {

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
                command === "foreverban"
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

            if (
                command === "unban"
            ) {

                return handleUnban(
                    message,
                    args
                );
            }

            // =================================================
            // WARN
            // =================================================

            if (
                command === "warn"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You need Moderator or higher."
                    );
                }

                const target =
                    message.mentions.members
                        .first();

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

            if (
                command === "timeout"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You need Moderator or higher."
                    );
                }

                const target =
                    message.mentions.members
                        .first();

                const minutes =
                    parseInt(
                        args[1]
                    ) || 10;

                if (!target) {

                    return message.reply(
                        "Usage: `-timeout @user 10`"
                    );
                }

                if (
                    !target.moderatable
                ) {

                    return message.reply(
                        "❌ I can't timeout that user."
                    );
                }

                await target.timeout(
                    minutes * 60 * 1000,
                    `Timeout by ${message.author.tag}`
                );

                return message.reply(
                    `⏱️ ${target} was timed out for ${minutes} minutes.`
                );
            }

            // =================================================
            // UNTIMEOUT
            // =================================================

            if (
                command === "untimeout"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You need Moderator or higher."
                    );
                }

                const target =
                    message.mentions.members
                        .first();

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

            if (
                command === "clear"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You need Moderator or higher."
                    );
                }

                const amount =
                    parseInt(args[0]);

                if (
                    isNaN(amount) ||
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

                return message.reply(
                    `🧹 Deleted ${deleted.size} messages.`
                );
            }

            // =================================================
            // LOCK
            // =================================================

            if (
                command === "lock"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You need Moderator or higher."
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

            if (
                command === "unlock"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You need Moderator or higher."
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
                command === "slowmode"
            ) {

                if (
                    !isModerator(
                        message.member
                    )
                ) {

                    return message.reply(
                        "❌ You need Moderator or higher."
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
                "[COMMAND ERROR]",
                error
            );

            await message.reply(
                "❌ Something went wrong while running that command."
            ).catch(() => {});
        }
    }
);

// ============================================================
// VC COMMANDS
// ============================================================

async function handleVCCommand(
    message,
    args
) {

    const action =
        args[0]?.toLowerCase();

    // ========================================================
    // VC HELP
    // ========================================================

    if (
        !action ||
        action === "help"
    ) {

        return message.reply({

            content: [
                "**🎙️ VC COMMANDS**",
                "",
                "`-vc setup` — Setup Join to Create",
                "`-vc help` — Show VC commands",
                "`-vc owner` — Show VC owner",
                "`-vc mute @user` — Server mute user",
                "`-vc unmute @user` — Unmute user",
                "`-vc kick @user` — Kick from VC",
                "`-vc reject @user` — Reject from VC",
                "`-vc ban @user` — Ban from VC",
                "`-vc unban @user` — Remove VC ban",
                "`-vc stfu @user` — Permanent STFU protection",
                "`-vc unstfu @user` — Remove STFU"
            ].join("\n")

        });
    }

    // ========================================================
    // SETUP
    // ========================================================

    if (
        action === "setup"
    ) {

        if (
            !isServerOwner(
                message.member
            ) &&
            !isFounder(
                message.member
            )
        ) {

            return message.reply(
                "❌ Only the Server Owner or Founder can setup Join to Create."
            );
        }

        const data =
            getGuildData(
                message.guild.id
            );

        // ----------------------------------------------------
        // CHECK EXISTING
        // ----------------------------------------------------

        if (
            data.triggerChannelId
        ) {

            const existing =
                message.guild.channels.cache
                    .get(
                        data.triggerChannelId
                    );

            if (existing) {

                return message.reply(
                    `❌ Join to Create is already setup: ${existing}`
                );
            }
        }

        // ----------------------------------------------------
        // CREATE CATEGORY
        // ----------------------------------------------------

        const category =
            await message.guild.channels.create({

                name:
                    "VOICE CHANNELS",

                type:
                    ChannelType.GuildCategory

            });

        // ----------------------------------------------------
        // CREATE TRIGGER
        // ----------------------------------------------------

        const trigger =
            await message.guild.channels.create({

                name:
                    "➕・Join To Create",

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
                "╔══════════════════════════════╗",
                "      **JTC SETUP COMPLETE**",
                "╚══════════════════════════════╝",
                "",
                `📁 Category: ${category}`,
                `🎙️ Trigger: ${trigger}`,
                "",
                "**How it works:**",
                "Join the trigger VC.",
                "You instantly get moved into your own VC.",
                "",
                "**Default Name:**",
                "`{username}'s Room`",
                "",
                "**Limit:** Unlimited",
                "**Bitrate:** 64kbps",
                "",
                "The VC owner can manage people inside their call."
            ].join("\n")

        });
    }

    // ========================================================
    // MUST BE IN VC
    // ========================================================

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
            "❌ This is not a Join to Create VC."
        );
    }

    // ========================================================
    // OWNER
    // ========================================================

    if (
        action === "owner"
    ) {

        return message.reply(
            `👑 VC Owner: <@${vc.ownerId}>`
        );
    }

    // ========================================================
    // VC MANAGEMENT CHECK
    // ========================================================

    if (
        !canManageVC(
            message.member,
            channel
        )
    ) {

        return message.reply(
            "❌ Only the VC Owner, God, Founder, or Server Owner can manage this VC."
        );
    }

    const target =
        message.mentions.members
            .first();

    // ========================================================
    // VC MUTE
    // ========================================================

    if (
        action === "mute"
    ) {

        if (!target) {

            return message.reply(
                "Usage: `-vc mute @user`"
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
            !botHasPermission(
                message.guild,
                PermissionFlagsBits.MuteMembers
            )
        ) {

            return message.reply(
                "❌ I need the **Mute Members** permission."
            );
        }

        await target.voice.setMute(
            true,
            `VC mute by ${message.author.tag}`
        );

        return message.reply(
            `🔇 ${target} has been server muted.`
        );
    }

    // ========================================================
    // VC UNMUTE
    // ========================================================

    if (
        action === "unmute"
    ) {

        if (!target) {

            return message.reply(
                "Usage: `-vc unmute @user`"
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
            data.stfuUsers.has(
                target.id
            )
        ) {

            return message.reply(
                "❌ That user has STFU protection. Use `-vc unstfu @user` first."
            );
        }

        await target.voice.setMute(
            false,
            `VC unmute by ${message.author.tag}`
        );

        return message.reply(
            `🔊 ${target} has been unmuted.`
        );
    }

    // ========================================================
    // VC KICK
    // ========================================================

    if (
        action === "kick"
    ) {

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
            !botHasPermission(
                message.guild,
                PermissionFlagsBits.MoveMembers
            )
        ) {

            return message.reply(
                "❌ I need the **Move Members** permission."
            );
        }

        // Do not allow VC owners to kick Founder/God.
        if (
            isHighCommand(target) &&
            !isHighCommand(message.member)
        ) {

            return message.reply(
                "❌ You cannot kick Founder/God/Server Owner."
            );
        }

        await target.voice.disconnect(
            `VC kick by ${message.author.tag}`
        );

        return message.reply(
            `🚪 ${target} was kicked from the VC.`
        );
    }

    // ========================================================
    // VC REJECT
    // ========================================================

    if (
        action === "reject"
    ) {

        if (!target) {

            return message.reply(
                "Usage: `-vc reject @user`"
            );
        }

        if (
            isHighCommand(target) &&
            !isHighCommand(message.member)
        ) {

            return message.reply(
                "❌ You cannot reject Founder/God/Server Owner."
            );
        }

        vc.rejectedUsers.add(
            target.id
        );

        await channel.permissionOverwrites
            .edit(
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
                    "Rejected from VC"
                )
                .catch(() => {});
        }

        return message.reply(
            `🚫 ${target} was rejected from this VC.`
        );
    }

    // ========================================================
    // VC BAN
    // ========================================================

    if (
        action === "ban"
    ) {

        if (!target) {

            return message.reply(
                "Usage: `-vc ban @user`"
            );
        }

        if (
            isHighCommand(target) &&
            !isHighCommand(message.member)
        ) {

            return message.reply(
                "❌ You cannot ban Founder/God/Server Owner."
            );
        }

        vc.bannedUsers.add(
            target.id
        );

        await channel.permissionOverwrites
            .edit(
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

    // ========================================================
    // VC UNBAN
    // ========================================================

    if (
        action === "unban"
    ) {

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

    // ========================================================
    // VC STFU
    // ========================================================

    if (
        action === "stfu"
    ) {

        if (!target) {

            return message.reply(
                "Usage: `-vc stfu @user`"
            );
        }

        if (
            !botHasPermission(
                message.guild,
                PermissionFlagsBits.MuteMembers
            )
        ) {

            return message.reply(
                "❌ I need the **Mute Members** permission."
            );
        }

        if (
            isHighCommand(target) &&
            !isHighCommand(message.member)
        ) {

            return message.reply(
                "❌ You cannot STFU Founder/God/Server Owner."
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
            `🔇 ${target} is now STFU protected.`
        );
    }

    // ========================================================
    // VC UNSTFU
    // ========================================================

    if (
        action === "unstfu"
    ) {

        if (!target) {

            return message.reply(
                "Usage: `-vc unstfu @user`"
            );
        }

        if (
            !isHighCommand(
                message.member
            )
        ) {

            return message.reply(
                "❌ Only Founder, God, or Server Owner can remove STFU protection."
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
// NORMAL KICK
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
            "❌ You need Moderator or higher."
        );
    }

    const target =
        message.mentions.members
            .first();

    if (!target) {

        return message.reply(
            "Usage: `-kick @user reason`"
        );
    }

    // High command protection.
    if (
        isHighCommand(target) &&
        !isHighCommand(message.member)
    ) {

        return message.reply(
            "❌ You cannot kick Founder/God/Server Owner."
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

    if (
        !target.kickable
    ) {

        return message.reply(
            "❌ I can't kick that user. Check my role hierarchy."
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
// BAN
// ============================================================

async function handleBan(
    message,
    args,
    forever
) {

    // ========================================================
    // FOREVERBAN
    // ========================================================

    if (forever) {

        if (
            !isHighCommand(
                message.member
            )
        ) {

            return message.reply(
                "❌ Only Founder, God, or Server Owner can use `-foreverban`."
            );
        }

    } else {

        // ====================================================
        // NORMAL BAN
        // ====================================================

        if (
            !isHighCommand(
                message.member
            )
        ) {

            return message.reply(
                "❌ Only Founder, God, or Server Owner can use `-ban`."
            );
        }
    }

    const target =
        message.mentions.members
            .first();

    if (!target) {

        return message.reply(

            forever
                ? "Usage: `-foreverban @user reason`"
                : "Usage: `-ban @user reason`"

        );
    }

    // --------------------------------------------------------
    // HIGH COMMAND PROTECTION
    // --------------------------------------------------------

    if (
        isHighCommand(target) &&
        !isServerOwner(message.member)
    ) {

        // Founder/God cannot ban the server owner.
        if (
            isServerOwner(target)
        ) {

            return message.reply(
                "❌ The Server Owner cannot be banned."
            );
        }

        // God cannot ban Founder.
        if (
            isFounder(target) &&
            !isFounder(message.member)
        ) {

            return message.reply(
                "❌ You cannot ban a Founder."
            );
        }
    }

    if (
        target.id ===
        message.author.id
    ) {

        return message.reply(
            "❌ You can't ban yourself."
        );
    }

    if (
        !target.bannable
    ) {

        return message.reply(
            "❌ I can't ban that user. Check my role hierarchy."
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

    // --------------------------------------------------------
    // FOREVERBAN SAVE
    // --------------------------------------------------------

    if (forever) {

        data.foreverBannedUsers.add(
            target.id
        );
    }

    // --------------------------------------------------------
    // BAN
    // --------------------------------------------------------

    await target.ban({

        deleteMessageSeconds: 0,

        reason:
            `${forever ? "[FOREVERBAN] " : ""}${reason} | ${message.author.tag}`

    });

    if (forever) {

        return message.reply({

            content: [
                "⛔ **FOREVERBAN COMPLETE**",
                "",
                `User: **${target.user.tag}**`,
                `Moderator: **${message.author.tag}**`,
                `Reason: **${reason}**`,
                "",
                "This user is now on the permanent ban list."
            ].join("\n")

        });

    }

    return message.reply(
        `🔨 **${target.user.tag}** was banned.`
    );
}

// ============================================================
// UNBAN
// ============================================================

async function handleUnban(
    message,
    args
) {

    if (
        !isHighCommand(
            message.member
        )
    ) {

        return message.reply(
            "❌ Only Founder, God, or Server Owner can use `-unban`."
        );
    }

    const userId =
        args[0];

    if (!userId) {

        return message.reply(
            "Usage: `-unban USER_ID`"
        );
    }

    const data =
        getGuildData(
            message.guild.id
        );

    // Remove forever ban list.
    data.foreverBannedUsers.delete(
        userId
    );

    try {

        await message.guild.members
            .unban(
                userId,
                `Unbanned by ${message.author.tag}`
            );

    } catch (error) {

        // User may not currently be banned.
        return message.reply(
            `⚠️ Removed ${userId} from the foreverban list, but Discord could not unban them.`
        );
    }

    return message.reply(
        `✅ <@${userId}> has been unbanned and removed from the foreverban list.`
    );
}

// ============================================================
// HELP
// ============================================================

async function sendHelp(
    message
) {

    const help = [

        "╔════════════════════════════════════╗",
        "             **TITAN BOT**",
        "╚════════════════════════════════════╝",
        "",
        "**🎙️ VOICE COMMANDS**",
        "",
        "`-vc setup`",
        "Setup the entire Join to Create system.",
        "",
        "`-vc help`",
        "Show VC commands.",
        "",
        "`-vc owner`",
        "Show the owner of your VC.",
        "",
        "`-vc mute @user`",
        "Server mute someone in your VC.",
        "",
        "`-vc unmute @user`",
        "Unmute someone in your VC.",
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
        "Force server mute with STFU protection.",
        "",
        "`-vc unstfu @user`",
        "Remove STFU protection.",
        "",
        "**🛡️ MODERATION**",
        "",
        "`-kick @user reason`",
        "`-ban @user reason`",
        "`-foreverban @user reason`",
        "`-unban USER_ID`",
        "`-warn @user reason`",
        "`-timeout @user 10`",
        "`-untimeout @user`",
        "`-clear 10`",
        "`-lock`",
        "`-unlock`",
        "`-slowmode 5`",
        "",
        "**⚙️ GENERAL**",
        "",
        "`-ping`",
        "`-botinfo`",
        "`-serverinfo`",
        "`-userinfo @user`",
        "`-avatar @user`",
        "`-help`",
        "",
        "**👑 RANK SYSTEM**",
        "",
        "**Founder**",
        "Full bot/server control.",
        "",
        "**God**",
        "High-level control and foreverban access.",
        "",
        "**Owner**",
        "Server moderation access.",
        "",
        "**Admin**",
        "Administrative access.",
        "",
        "**Moderator**",
        "Moderation access.",
        "",
        "**Helper**",
        "Basic staff access."
    ];

    return message.reply({
        content:
            help.join("\n")
    });
}

// ============================================================
// LOGIN
// ============================================================

if (
    !process.env.DISCORD_TOKEN
) {

    console.error(
        "❌ DISCORD_TOKEN is missing from .env"
    );

    process.exit(1);
}

client.login(
    process.env.DISCORD_TOKEN
);
// LOGIN
// ============================================================

client.login(MTU0NDEwMTE2OTI4OTIzMjQ0Ng.Gsz7IB.rvyd7fu7ppetH_itjGhAqJoBWISZvINa-3yEjo);
