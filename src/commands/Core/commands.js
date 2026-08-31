import discord
from discord.ext import commands
import time

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="-", intents=intents)
start_time = time.time()

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")

# PING
@bot.command()
async def ping(ctx):
    await ctx.send(f"🏓 {round(bot.latency * 1000)}ms")

# SERVER INFO
@bot.command()
async def server(ctx):
    g = ctx.guild
    embed = discord.Embed(title=g.name)
    embed.add_field(name="Members", value=g.member_count)
    embed.add_field(name="Owner", value=g.owner.mention)
    embed.add_field(name="Channels", value=len(g.channels))
    await ctx.send(embed=embed)

# USER INFO
@bot.command()
async def user(ctx, member: discord.Member = None):
    member = member or ctx.author
    embed = discord.Embed(title=member.display_name)
    embed.add_field(name="Username", value=str(member))
    embed.add_field(name="ID", value=member.id)
    embed.add_field(name="Joined", value=member.joined_at.strftime("%Y-%m-%d"))
    embed.set_thumbnail(url=member.display_avatar.url)
    await ctx.send(embed=embed)

# AVATAR
@bot.command()
async def avatar(ctx, member: discord.Member = None):
    member = member or ctx.author
    await ctx.send(member.display_avatar.url)

# SAY
@bot.command()
async def say(ctx, *, message):
    await ctx.send(message)

# EMBED
@bot.command()
async def embed(ctx, *, message):
    e = discord.Embed(description=message)
    await ctx.send(embed=e)

# UPTIME
@bot.command()
async def uptime(ctx):
    seconds = int(time.time() - start_time)
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    await ctx.send(f"⏱️ Uptime: `{hours}h {minutes}m {seconds}s`")

# VC SETUP
@bot.command()
@commands.has_permissions(manage_channels=True)
async def vc(ctx, action=None):
    if action == "setup":
        category = await ctx.guild.create_category("VOICE")
        await ctx.guild.create_voice_channel("Join To Create", category=category)
        await ctx.send("✅ VC system created.")

    elif action == "create":
        channel = await ctx.guild.create_voice_channel(
            f"{ctx.author.display_name}'s VC"
        )
        await ctx.author.move_to(channel)
        await ctx.send(f"✅ Created {channel.mention}")

    else:
        await ctx.send("Use `-vc setup` or `-vc create`.")

# HELP
@bot.command()
async def help(ctx):
    embed = discord.Embed(title="Bot Commands")
    embed.description = """
`-ping` — Bot latency
`-server` — Server information
`-user @user` — User information
`-avatar @user` — User avatar
`-say <message>` — Send a message
`-embed <message>` — Send an embed
`-uptime` — Bot uptime
`-vc setup` — Setup VC system
`-vc create` — Create a VC
`-help` — Show commands
"""
    await ctx.send(embed=embed)

bot.run("YOUR_BOT_TOKEN")
