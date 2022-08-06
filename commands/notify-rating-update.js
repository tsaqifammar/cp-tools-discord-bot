const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');

const URLS = {
  codeforces: 'https://codeforces.com/profile/',
  atcoder: 'https://atcoder.jp/users/',
};

const getRating = {
  codeforces: async function (username) {
    const response = await axios.get(URLS.codeforces + username);
    const htmlData = response.data;
    const $ = cheerio.load(htmlData);
    const spans = $('.info').find('span[style=font-weight:bold;]');
    const rating = $(spans[0]).text();
    if (!rating) throw new Error('username-not-found');
    return parseInt(rating);
  },
  atcoder: async function (username) {
    const response = await axios.get(URLS.atcoder + username);
    const htmlData = response.data;
    const $ = cheerio.load(htmlData);
    const trs = $('.dl-table tr');
    const span = $(trs[4]).find('span')[0];
    const rating = $(span).text();
    if (!rating) throw new Error('username-not-found');
    return parseInt(rating);
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notify-rating-update')
    .setDescription('Notify you when your rating updates!')
    .addStringOption((option) =>
      option
        .setName('oj')
        .setDescription('The online judge to track')
        .setRequired(true)
        .addChoices(
          { name: 'Codeforces', value: 'codeforces' },
          { name: 'Atcoder', value: 'atcoder' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('username')
        .setDescription('Username of your account')
        .setRequired(true)
    ),
  async execute(interaction) {
    const channel = interaction.channel;
    const oj = interaction.options.getString('oj');
    const username = interaction.options.getString('username');
    await interaction.reply( `Tracking rating updates for ${username} on ${oj}... I will notify you once updated.`);

    let currentRating = 0;
    try {
      currentRating = await getRating[oj](username);
    } catch (error) {
      await interaction.followUp(`Username not found.`);
      return;
    }

    let cnt = -1;
    async function getNewRatingAndCompare() {
      try {
        const newRating = await getRating[oj](username);
        console.log(`${cnt} ${username} [initial rating: ${currentRating}, found: ${newRating}]`);
        if (newRating !== currentRating) {
          let diff = newRating - currentRating;
          let delta = diff.toString();
          if (diff >= 0) delta = '+' + delta;
          const msg = `${username}: ${currentRating} -> ${newRating} (${delta})`;
          channel.send({ content: msg });
          return true;
        }
      } catch (error) {
        console.log(error);
      }
      return false;
    }

    const MAX_CNT = 60*24;
    if (await getNewRatingAndCompare()) return;
    const timerId = setInterval(async () => {
      cnt++;

      if (cnt === MAX_CNT) {
        const msg = `It's been a day but ${username}'s rating hasn't been updated on ${oj}. I will stop tracking.`;
        channel.send({ content: msg });
        clearInterval(timerId);
      } else {
        try {
          if (await getNewRatingAndCompare()) clearInterval(timerId);
        } catch (error) {
          const msg = `An error happened while tracking ${username}'s rating`;
          channel.send({ content: msg });
          clearInterval(timerId);
        }
      }
    }, 60000);
  },
};
