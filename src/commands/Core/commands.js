`const prefix = '-';

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content
        .slice(prefix.length)
        .trim()
        .split(/\s+/);

    const command = args.shift()?.toLowerCase();

    if (command !== 'vc') return;

    const subcommand = args.shift()?.toLowerCase();

    if (subcommand === 'setup') {
        // setup code
    }

    if (subcommand === 'create') {
        // create code
    }

    if (subcommand === 'delete') {
        // delete code
    }

    if (subcommand === 'rename') {
        // rename code
    }

    if (subcommand === 'limit') {
        // limit code
    }

    if (subcommand === 'lock') {
        // lock code
    }

    if (subcommand === 'unlock') {
        // unlock code
    }

    if (subcommand === 'stfu') {
        // stfu code
    }

    if (subcommand === 'unstfu') {
        // unstfu code
    }

    if (subcommand === 'kick') {
        // kick code
    }

    if (subcommand === 'transfer') {
        // transfer code
    }

    if (subcommand === 'info') {
        // info code
    }
});
