```python
import discord
from discord.ext import commands
import time

# =========================
# BOT SETUP
# =========================

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(
    command_prefix="-",
    intents=intents,
    help_command=None
)

start_time = time.time()


# =========================
# READY
# =========================

@bot.event
async def on_ready():
    print(f"✅ Logged in as {bot.user}")
    print(f"📡 Connected to {len(bot.guilds)} server(s)")


# =========================
# PING
# =========================

@bot.command()
async def ping(ctx):
    ms = round(bot.latency * 1000)
    await ctx.send(f"🏓 Pong! `{ms}ms`")


# =========================
# UPTIME
# =========================

@bot.command()
async def uptime(ctx):
    seconds = int(time.time() - start_time)

    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    await ctx.send(
        f"⏱️ **Bot Uptime**\n"
        f"`{hours}h {minutes}m {seconds}s`"
    )


# =========================
# SERVER INFO
# =========================

@bot.command()
async def server(ctx):
    guild = ctx.guild

    embed = discord.Embed(
        title=f"🏠 {guild.name}",
        description="Server information"
    )

    embed.add_field(
        name="👥 Members",
        value=str(guild.member_count),
        inline=True
    )

    embed.add_field(
        name="👑 Owner",
        value=guild.owner.mention if guild.owner else "Unknown",
        inline=True
    )

    embed.add_field(
        name="💬 Channels",
        value=str(len(guild.channels)),
        inline=True
    )

    embed.add_field(
        name="🆔 Server ID",
        value=str(guild.id),
        inline=False
    )

    if guild.icon:
        embed.set_thumbnail(url=guild.icon.url)

    await ctx.send(embed=embed)


# =========================
# USER INFO
# =========================

@bot.command()
async def user(ctx, member: discord.Member = None):
    member = member or ctx.author

    embed = discord.Embed(
        title=f"👤 {member.display_name}",
        description="User information"
    )

    embed.add_field(
        name="Username",
        value=str(member),
        inline=True
    )

    embed.add_field(
        name="ID",
        value=str(member.id),
        inline=True
    )

    embed.add_field(
        name="Joined Server",
        value=member.joined_at.strftime("%Y-%m-%d")
        if member.joined_at else "Unknown",
        inline=False
    )

    embed.set_thumbnail(url=member.display_avatar.url)

    await ctx.send(embed=embed)


# =========================
# AVATAR
# =========================

@bot.command()
async def avatar(ctx, member: discord.Member = None):
    member = member or ctx.author

    embed = discord.Embed(
        title=f"🖼️ {member.display_name}'s Avatar"
    )

    embed.set_image(url=member.display_avatar.url)

    await ctx.send(embed=embed)


# =========================
# SAY
# =========================

@bot.command()
async def say(ctx, *, message):
    await ctx.send(message)


# =========================
# EMBED
# =========================

@bot.command()
async def embed(ctx, *, message):
    e = discord.Embed(
        description=message
    )

    await ctx.send(embed=e)


# =========================
# VC COMMAND
# =========================

@bot.group(invoke_without_command=True)
@commands.has_permissions(manage_channels=True)
async def vc(ctx):
    await ctx.send(
        "🔊 **VC Commands**\n\n"
        "`-vc setup` — Create the VC system\n"
        "`-vc create` — Create a personal VC"
    )


# =========================
# VC SETUP
# =========================

@vc.command(name="setup")
@commands.has_permissions(manage_channels=True)
async def vc_setup(ctx):

    guild = ctx.guild

    # Check if setup already exists
    existing_category = discord.utils.get(
        guild.categories,
        name="VOICE"
    )

    if existing_category:
        await ctx.send("⚠️ The VC system is already set up.")
        return

    category = await guild.create_category("VOICE")

    await guild.create_voice_channel(
        "➕ Join To Create",
        category=category
    )

    await ctx.send(
        "✅ **VC system created!**\n"
        "Use `-vc create` to create your own voice channel."
    )


# =========================
# VC CREATE
# =========================

@vc.command(name="create")
@commands.has_permissions(manage_channels=True)
async def vc_create(ctx):

    guild = ctx.guild

    category = discord.utils.get(
        guild.categories,
        name="VOICE"
    )

    if category is None:
        await ctx.send(
            "❌ VC system isn't set up yet.\n"
            "Use `-vc setup` first."
        )
        return

    channel = await guild.create_voice_channel(
        f"🔊 {ctx.author.display_name}'s VC",
        category=category
    )

    await ctx.send(
        f"✅ Created {channel.mention}"
    )


# =========================
# HELP
# =========================

@bot.command()
async def help(ctx):

    embed = discord.Embed(
        title="🤖 Bot Help",
        description=(
            "Simple commands and how to use them.\n"
            "Prefix: `-`"
        )
    )

    embed.add_field(
        name="🏓 Basic Commands",
        value=(
            "`-ping`\n"
            "Check the bot's response time.\n\n"
            "`-uptime`\n"
            "See how long the bot has been online."
        ),
        inline=False
    )

    embed.add_field(
        name="👤 User Commands",
        value=(
            "`-user`\n"
            "Shows your user information.\n\n"
            "`-user @user`\n"
            "Shows another user's information.\n\n"
            "`-avatar`\n"
            "Shows your avatar.\n\n"
            "`-avatar @user`\n"
            "Shows another user's avatar."
        ),
        inline=False
    )

    embed.add_field(
        name="🏠 Server Commands",
        value=(
            "`-server`\n"
            "Shows basic server information."
        ),
        inline=False
    )

    embed.add_field(
        name="💬 Message Commands",
        value=(
            "`-say <message>`\n"
            "Makes the bot send your message.\n"
            "Example: `-say welcome everyone`\n\n"
            "`-embed <message>`\n"
            "Sends your message inside an embed.\n"
            "Example: `-embed welcome to the server`"
        ),
        inline=False
    )

    embed.add_field(
        name="🔊 Voice Commands",
        value=(
            "`-vc`\n"
            "Shows VC commands.\n\n"
            "`-vc setup`\n"
            "Creates the VOICE category and Join To Create channel.\n\n"
            "`-vc create`\n"
            "Creates a personal voice channel."
        ),
        inline=False
    )

    embed.add_field(
        name="📖 Getting Started",
        value=(
            "**1.** Use `-help` to see commands.\n"
            "**2.** Use `-vc setup` to set up voice channels.\n"
            "**3.** Use `-vc create` to create a VC.\n"
            "**4.** Use `-server` for server info.\n"
            "**5.** Use `-user @user` for user info."
        ),
        inline=False
    )

    embed.set_footer(
        text="Simple Utility Bot • Prefix: -"
    )

    await ctx.send(embed=embed)


# =========================
# ERROR HANDLING
# =========================

@bot.event
async def on_command_error(ctx, error):

    if isinstance(error, commands.CommandNotFound):
        return

    if isinstance(error, commands.MissingPermissions):
        await ctx.send(
            "❌ You don't have permission to use this command."
        )
        return

    if isinstance(error, commands.MissingRequiredArgument):
        await ctx.send(
            "❌ You're missing something.\n"
            "Use `-help` to see how to use the command."
        )
        return

    print(f"Command error: {error}")


# =========================
# START BOT
# =========================

bot.run("YOUR_BOT_TOKEN")
```
