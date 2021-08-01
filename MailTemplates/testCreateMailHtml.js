const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const registerHelpers = require("@dynamail/handlebarshelpers").default;

registerHelpers(handlebars);
const templatePath = path.join(__dirname, "dist/order.en.html");
const template = fs.readFileSync(templatePath).toString();
const templateHbs = handlebars.compile(template);
const dataPath = path.join(__dirname, "src/order/data.json");
const dataString = fs.readFileSync(dataPath).toString();
const data = JSON.parse(dataString);
const resultHtml = templateHbs(data);
fs.writeFileSync(path.join(__dirname, "out.html"), resultHtml);
console.log("done");