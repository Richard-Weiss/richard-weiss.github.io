module.exports = function() {
  const isProd = process.env.ELEVENTY_ENV === 'production';

  return {
    title: "Weiss Noise",
    description: "Because someone should write this down",
    author: "Richard Weiss",
    url: isProd ? "https://richard-weiss.github.io" : "http://blog.homelab",
    github: "https://github.com/richard-weiss/richard-weiss.github.io",
    githubBranch: "main"
  };
};
