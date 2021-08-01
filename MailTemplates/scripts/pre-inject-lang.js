module.exports = function injectLang(code, template) {
  return code.replace(
    '<mj-head>',
    `<mj-head><mj-attributes><mj-all lang="${template.language}" /></mj-attributes>`,
  );
};
