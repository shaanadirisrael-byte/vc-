// ===============================
// RANKS + COMMAND PERMISSIONS
// ===============================

const RANKS = {
  FOUNDER: "founder",
  GOD: "god",
  OWNER: "owner",
  COOWNER: "co-owner",
  DIRECTOR: "director",
  ADMIN: "admin",
  MOD: "moderator",
  STAFF: "staff",
  TRUSTED: "trusted",
  MEMBER: "member"
};

const RANK_POWER = {
  member: 0,
  trusted: 1,
  staff: 2,
  moderator: 3,
  admin: 4,
  director: 5,
  "co-owner": 6,
  owner: 7,
  god: 8,
  founder: 9
};

function getRank(member) {
  // Server owner = Founder
  if (member.guild.ownerId === member.id)
    return RANKS.FOUNDER;

  const roles = member.roles.cache.map(r =>
    r.name.toLowerCase()
  );

  // Highest rank wins
  const ranks = Object.values(RANKS)
    .filter(rank => roles.includes(rank))
    .sort((a, b) =>
      RANK_POWER[b] - RANK_POWER[a]
    );

  return ranks[0] || RANKS.MEMBER;
}

function hasRank(member, requiredRank) {
  const userRank = getRank(member);

  return (
    RANK_POWER[userRank] >=
    RANK_POWER[requiredRank]
  );
}

function isFounder(member) {
  return hasRank(member, RANKS.FOUNDER);
}

function isGod(member) {
  return hasRank(member, RANKS.GOD);
}

function isServerOwner(member) {
  return member.guild.ownerId === member.id;
}


// ===============================
// COMMAND PERMISSION CHECK
// ===============================

function canUseCommand(member, command) {

  switch (command) {

    // Founder only
    case "-foreverban":
    case "-foreverunban":
      return isFounder(member);

    // God+
    case "-ban":
    case "-unban":
      return isGod(member);

    // Mod+
    case "-kick":
      return hasRank(member, RANKS.MOD);

    // Staff+
    case "-mute":
    case "-unmute":
      return hasRank(member, RANKS.STAFF);

    default:
      return true;
  }
}


// ===============================
// VC OWNER CHECK
// ===============================

function getRoomOwner(db, channelId) {

  if (!db.rooms) return null;

  return db.rooms[channelId] || null;
}

function canControlVC(member, room) {

  if (!room) return false;

  // Founder
  if (isFounder(member))
    return true;

  // God
  if (isGod(member))
    return true;

  // Server owner
  if (isServerOwner(member))
    return true;

  // Actual VC owner
  if (room.owner === member.id)
    return true;

  return false;
}


// ===============================
// MESSAGE COMMANDS
// ===============================

client.on("messageCreate", async message => {

  try {

    if (!message.guild) return;
    if (message.author.bot) return;

    const args = message.content
      .trim()
      .split(/\s+/);

    const command =
      args.shift()?.toLowerCase();

    if (!command) return;


    // ===========================
    // SERVER KICK
    // ===========================

    if (command === "-kick") {

      if (!canUseCommand(
        message.member,
        "-kick"
      )) {
        return message.reply(
          "❌ You need **Moderator** rank or higher."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target)
        return message.reply(
          "❌ Mention someone."
        );

      if (
        target.id === message.author.id
      ) {
        return message.reply(
          "❌ You cannot kick yourself."
        );
      }

      if (!target.kickable) {
        return message.reply(
          "❌ I cannot kick this member."
        );
      }

      await target.kick(
        `Kicked by ${message.author.tag}`
      );

      return message.reply(
        `✅ Kicked **${target.user.tag}**.`
      );
    }


    // ===========================
    // SERVER BAN
    // ===========================

    if (command === "-ban") {

      if (!canUseCommand(
        message.member,
        "-ban"
      )) {
        return message.reply(
          "❌ You need **God** rank or higher."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target)
        return message.reply(
          "❌ Mention someone."
        );

      if (
        target.id === message.author.id
      ) {
        return message.reply(
          "❌ You cannot ban yourself."
        );
      }

      if (!target.bannable) {
        return message.reply(
          "❌ I cannot ban this member."
        );
      }

      await target.ban({
        reason:
          `Banned by ${message.author.tag}`
      });

      return message.reply(
        `🔨 Banned **${target.user.tag}**.`
      );
    }


    // ===========================
    // FOREVER BAN
    // ===========================

    if (command === "-foreverban") {

      if (!canUseCommand(
        message.member,
        "-foreverban"
      )) {
        return message.reply(
          "❌ Only **Founder** can use Foreverban."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target)
        return message.reply(
          "❌ Mention someone."
        );

      if (!db.bans)
        db.bans = {};

      if (!db.bans[message.guild.id])
        db.bans[message.guild.id] = [];

      if (
        !db.bans[message.guild.id]
          .includes(target.id)
      ) {
        db.bans[message.guild.id]
          .push(target.id);
      }

      save();

      if (target.bannable) {
        await target.ban({
          reason:
            `Foreverbanned by ${message.author.tag}`
        }).catch(() => {});
      }

      return message.reply(
        `⛔ **${target.user.tag}** has been permanently banned.`
      );
    }


    // ===========================
    // VC COMMANDS
    // ===========================

    if (command === "-vc") {

      const subcommand =
        args.shift()?.toLowerCase();


      // =========================
      // VC SETUP
      // =========================

      if (subcommand === "setup") {

        if (
          !isFounder(message.member) &&
          !isGod(message.member) &&
          !isServerOwner(message.member)
        ) {
          return message.reply(
            "❌ Only **Founder, God, or Server Owner** can setup Join to Create."
          );
        }

        return setupJoinToCreate(message);
      }


      // =========================
      // MUST BE IN VC
      // =========================

      const voice =
        message.member.voice.channel;

      if (!voice) {
        return message.reply(
          "❌ You must be inside your temporary VC."
        );
      }

      const room =
        getRoomOwner(db, voice.id);

      if (!room) {
        return message.reply(
          "❌ This is not a temporary VC."
        );
      }

      // =========================
      // VC PERMISSION
      // =========================

      if (
        !canControlVC(
          message.member,
          room
        )
      ) {
        return message.reply(
          "❌ You do not control this VC."
        );
      }


      // =========================
      // VC KICK
      // =========================

      if (subcommand === "kick") {

        const target =
          message.mentions.members.first();

        if (!target)
          return message.reply(
            "❌ Mention someone."
          );

        if (
          target.id === room.owner
        ) {
          return message.reply(
            "❌ You cannot kick the VC owner."
          );
        }

        await target.voice
          .disconnect(
            "VC owner kick"
          )
          .catch(() => {});

        return message.reply(
          `👢 Kicked **${target.user.tag}** from the VC.`
        );
      }


      // =========================
      // VC REJECT
      // =========================

      if (subcommand === "reject") {

        const target =
          message.mentions.members.first();

        if (!target)
          return message.reply(
            "❌ Mention someone."
          );

        if (!room.rejects)
          room.rejects = [];

        if (
          !room.rejects.includes(
            target.id
          )
        ) {
          room.rejects.push(
            target.id
          );
        }

        if (
          target.voice.channelId ===
          voice.id
        ) {
          await target.voice
            .disconnect()
            .catch(() => {});
        }

        save();

        return message.reply(
          `🚫 **${target.user.tag}** is rejected from this VC.`
        );
      }


      // =========================
      // VC BAN
      // =========================

      if (subcommand === "ban") {

        const target =
          message.mentions.members.first();

        if (!target)
          return message.reply(
            "❌ Mention someone."
          );

        if (!room.bans)
          room.bans = [];

        if (
          !room.bans.includes(
            target.id
          )
        ) {
          room.bans.push(
            target.id
          );
        }

        if (
          target.voice.channelId ===
          voice.id
        ) {
          await target.voice
            .disconnect(
              "VC ban"
            )
            .catch(() => {});
        }

        save();

        return message.reply(
          `🔨 **${target.user.tag}** is banned from this VC.`
        );
      }


      // =========================
      // VC STFU
      // =========================

      if (subcommand === "stfu") {

        const target =
          message.mentions.members.first();

        if (!target)
          return message.reply(
            "❌ Mention someone."
          );

        if (!room.muted)
          room.muted = [];

        if (
          !room.muted.includes(
            target.id
          )
        ) {
          room.muted.push(
            target.id
          );
        }

        await target.voice
          .setMute(
            true,
            "VC force mute"
          )
          .catch(() => {});

        save();

        return message.reply(
          `🔇 **${target.user.tag}** is force-muted.`
        );
      }


      // =========================
      // VC UNSTFU
      // =========================

      if (subcommand === "unstfu") {

        const target =
          message.mentions.members.first();

        if (!target)
          return message.reply(
            "❌ Mention someone."
          );

        if (room.muted) {

          room.muted =
            room.muted.filter(
              id => id !== target.id
            );
        }

        await target.voice
          .setMute(
            false,
            "VC force mute removed"
          )
          .catch(() => {});

        save();

        return message.reply(
          `🔊 **${target.user.tag}** can speak again.`
        );
      }


      // =========================
      // VC LOCK
      // =========================

      if (subcommand === "lock") {

        await voice.permissionOverwrites.edit(
          message.guild.roles.everyone,
          {
            Connect: false
          }
        );

        return message.reply(
          "🔒 VC locked."
        );
      }


      // =========================
      // VC UNLOCK
      // =========================

      if (subcommand === "unlock") {

        await voice.permissionOverwrites.edit(
          message.guild.roles.everyone,
          {
            Connect: true
          }
        );

        return message.reply(
          "🔓 VC unlocked."
        );
      }


      // =========================
      // VC LIMIT
      // =========================

      if (subcommand === "limit") {

        const limit =
          Number(args[0]);

        if (
          isNaN(limit) ||
          limit < 0 ||
          limit > 99
        ) {
          return message.reply(
            "❌ Limit must be between 0 and 99."
          );
        }

        await voice.setUserLimit(limit);

        return message.reply(
          `👥 VC limit set to **${
            limit === 0
              ? "Unlimited"
              : limit
          }**.`
        );
      }


      // =========================
      // VC NAME
      // =========================

      if (subcommand === "name") {

        const name =
          args.join(" ");

        if (!name)
          return message.reply(
            "❌ Enter a channel name."
          );

        await voice.setName(
          name.slice(0, 100)
        );

        return message.reply(
          `✏️ VC renamed to **${name.slice(0, 100)}**.`
        );
      }

      return message.reply(
        "❌ Unknown VC command."
      );
    }

  } catch (error) {

    console.error(
      "COMMAND ERROR:",
      error
    );

    message.reply(
      "❌ Something went wrong. The bot is still running."
    ).catch(() => {});
  }
});
