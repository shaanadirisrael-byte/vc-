// commands/vc.js

import {
    PermissionFlagsBits
} from "discord.js";

import {
    getTemporaryChannel,
    banUserFromTemporaryChannel
} from "../services/joinToCreateService.js";

export default {
    name: "vc",
    aliases: ["voice"],

    async execute(message, args) {
        if (!message.guild) return;

        const member = message.member;

        if (!member?.voice?.channel) {
            return message.reply(
                "❌ You need to be inside a temporary VC."
            );
        }

        const voiceChannel =
            member.voice.channel;

        const tempChannel =
            getTemporaryChannel(
                message.guild.id,
                voiceChannel.id
            );

        if (!tempChannel) {
            return message.reply(
                "❌ This isn't a temporary Join to Create VC."
            );
        }

        /*
        ==========================================
        OWNER CHECK
        ==========================================
        */

        const isVCOwner =
            tempChannel.ownerId === message.author.id;

        const isServerOwner =
            message.guild.ownerId === message.author.id;

        if (!isVCOwner && !isServerOwner) {
            return message.reply(
                "❌ Only the **VC owner** or **server owner** can manage this VC."
            );
        }

        const action =
            args[0]?.toLowerCase();

        /*
        ==========================================
        HELP
        ==========================================
        */

        if (!action) {
            return message.reply(
                [
                    "**VC Commands**",
                    "`-vc kick @user` — Kick someone from your VC",
                    "`-vc reject @user` — Reject someone from your VC",
                    "`-vc ban @user` — Ban someone from your VC"
                ].join("\n")
            );
        }

        /*
        ==========================================
        GET TARGET
        ==========================================
        */

        const target =
            message.mentions.members.first();

        if (!target) {
            return message.reply(
                `❌ Usage: \`-vc ${action} @user\``
            );
        }

        /*
        Don't allow the owner to target themselves.
        */

        if (target.id === message.author.id) {
            return message.reply(
                "❌ You can't use this on yourself."
            );
        }

        /*
        Make sure they're actually in this VC.
        */

        if (
            !voiceChannel.members.has(
                target.id
            )
        ) {
            return message.reply(
                "❌ That user isn't in your VC."
            );
        }

        /*
        ==========================================
        KICK
        ==========================================
        */

        if (action === "kick") {

            if (
                !message.guild.members.me.permissions.has(
                    PermissionFlagsBits.MoveMembers
                )
            ) {
                return message.reply(
                    "❌ I need the **Move Members** permission."
                );
            }

            await target.voice.disconnect(
                `JTC VC kick by ${message.author.tag}`
            );

            return message.reply(
                `🚪 ${target.user.tag} was kicked from your VC.`
            );
        }

        /*
        ==========================================
        REJECT
        ==========================================
        */

        if (action === "reject") {

            if (
                !message.guild.members.me.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                return message.reply(
                    "❌ I need the **Manage Channels** permission."
                );
            }

            /*
            Remove their ability to connect
            to this temporary VC.
            */

            await voiceChannel.permissionOverwrites.edit(
                target.id,
                {
                    Connect: false
                },
                {
                    reason:
                        `JTC VC reject by ${message.author.tag}`
                }
            );

            await target.voice.disconnect(
                `JTC VC reject by ${message.author.tag}`
            ).catch(() => {});

            return message.reply(
                `🚫 ${target.user.tag} was rejected from your VC.`
            );
        }

        /*
        ==========================================
        BAN
        ==========================================
        */

        if (action === "ban") {

            if (
                !message.guild.members.me.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                return message.reply(
                    "❌ I need the **Manage Channels** permission."
                );
            }

            banUserFromTemporaryChannel(
                message.guild.id,
                voiceChannel.id,
                target.id
            );

            /*
            Permanently prevent them from
            connecting to THIS temporary VC
            while it exists.
            */

            await voiceChannel.permissionOverwrites.edit(
                target.id,
                {
                    Connect: false,
                    ViewChannel: false
                },
                {
                    reason:
                        `JTC VC ban by ${message.author.tag}`
                }
            );

            await target.voice.disconnect(
                `JTC VC ban by ${message.author.tag}`
            ).catch(() => {});

            return message.reply(
                `🔨 ${target.user.tag} was banned from your VC.`
            );
        }

        /*
        ==========================================
        UNKNOWN COMMAND
        ==========================================
        */

        return message.reply(
            "❌ Unknown VC command. Use `-vc kick`, `-vc reject`, or `-vc ban`."
        );
    }
};
