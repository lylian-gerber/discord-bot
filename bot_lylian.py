import discord
from discord.ext import commands
TOKEN = 'ODI5MDQ0MzA3MDc1Mzk5ODAw.YGyZrQ.IWxIyxN3jdI44MRueYuH1ZkqM9w'
description='''Lylian bot'''
default_intents = discord.Intents.default()
default_intents.members = True
bot = commands.Bot(command_prefix='!', description=description,intents=default_intents)



@bot.command()
async def key(ctx,key):
    if str(ctx.channel.id)==str(ctx.author.dm_channel.id):

        key=str(key)
        k=0
        base=open('keys.txt','r')
        for line in base:
            line2=line.rstrip('\n')
            if line2==key:
                await ctx.channel.send('BIENVENUE CHEZ HIJOS SNEAK')
                await ctx.channel.send('https://discord.gg/RyffvH2m')

                k=1
                break
        if k==0:
            await ctx.channel.send("Le format de la clé n'est pas le bon : AAAA-0123-4567-8910\nLongueur d'une clé : 19 caractères\nContactez le staff sur le serveur Discord en cas de clé erronée")
    else:
        await ctx.channel.send("Tu ne peux envoyer de clés que en mp")
bot.run(TOKEN)
        
        
