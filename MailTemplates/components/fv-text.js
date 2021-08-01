const { BodyComponent } = require('mjml-core');

/**
 * This component is mainly just a placeholder component. It will actually never
 * be used by mjml. Instead our compiler step will replace all of these tags
 * with a corresponding translation (if one exists).
 *
 * Translations should be placed in a file called `translations.json` inside the
 * same directory as the template.
 */
module.exports = class FvText extends BodyComponent {
  static componentName = 'fv-text';

  static endingTag = true;

  static allowedAttributes = {};

  static dependencies = {
    'fv-text': [],
    'mj-column': ['fv-text'],
    'mj-hero': ['fv-text'],
  };

  render() {
    return this.renderMJML(
      `<mj-text color="red">${this.getAttribute(
        'lang',
      )} - ${this.getContent()}</mj-text>`,
    );
  }
};
