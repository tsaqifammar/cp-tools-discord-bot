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
    if (!rating) throw new Error();
    return parseInt(rating);
  },
  atcoder: async function (username) {
    const response = await axios.get(URLS.atcoder + username);
    const htmlData = response.data;
    const $ = cheerio.load(htmlData);
    const trs = $('.dl-table tr');
    const span = $(trs[4]).find('span')[0];
    const rating = $(span).text();
    if (!rating) throw new Error();
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
    )
    .addIntegerOption((option) =>
      option
        .setName('current-rating')
        .setDescription('What your current rating is')
        .setRequired(true)
    ),
  async execute(interaction) {
    const oj = interaction.options.getString('oj');
    const username = interaction.options.getString('username');
    const currentRating = interaction.options.getInteger('current-rating');

    await interaction.reply(
      `Tracking rating updates for ${username} on ${oj}... I will notify you once updated.`
    );

    async function getNewRatingAndCompare() {
      try {
        const newRating = await getRating[oj](username);
        if (newRating !== currentRating) {
          let diff = newRating - currentRating;
          let delta = diff.toString();
          if (diff >= 0) delta = '+' + delta;
          interaction.followUp(
            `${username}: ${currentRating} -> ${newRating} (${delta})`
          );
          return true;
        }
      } catch (error) {
        interaction.followUp(`Username not found.`);
        return true;
      }
      return false;
    }

    const MAX_CNT = 60*24;
    let cnt = -1;
    if (await getNewRatingAndCompare()) return;
    const timerId = setInterval(async () => {
      cnt++;

      if (cnt === MAX_CNT) {
        interaction.followUp(
          `It's been a day but ${username}'s rating hasn't been updated on ${oj}. I will stop tracking.`
        );
        clearInterval(timerId);
      } else {
        try {
          if (await getNewRatingAndCompare()) clearInterval(timerId);
        } catch (error) {
          interaction.followUp(
            `An error happened while tracking ${username}'s rating`
          );
          clearInterval(timerId);
        }
      }
    }, 60000);
  },
};
