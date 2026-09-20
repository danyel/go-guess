export default {
  paths: ["features/**/*.feature"],
  import: ["support/**/*.js", "steps/**/*.js"],
  format: ["progress", "html:reports/cucumber.html"],
  formatOptions: {
    snippetInterface: "async-await",
  },
  parallel: 1,
};
