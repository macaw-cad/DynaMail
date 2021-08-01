declare const require: any;

const registerHelpers = (handlebars: any): void => {
    // extend Handlebars with the helper functions - see https://github.com/helpers/handlebars-helpers for examples
    handlebars.registerHelper('replace', (str: string, a: string, b: string) => {
        if (!str) return '';
        if (!a) return str;
        if (!b) {
            b = "";
        }
        return str.split(a).join(b);
    });

    handlebars.registerHelper('not', (val: boolean, options: any) => {
        return !val;
    });
  
    // https://stackoverflow.com/questions/34252817/handlebarsjs-check-if-a-string-is-equal-to-a-value
    handlebars.registerHelper('eq', function(arg1: string, arg2: string, options: any) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // https://github.com/helpers/handlebars-helpers/blob/master/lib/comparison.js#L492
    handlebars.registerHelper('or', function() {
        var len = arguments.length - 1;
        var options = arguments[len];
        var val = false;
        for (var i = 0; i < len; i++) {
          if (arguments[i]) {
            val = true;
            break;
          }
        }
        return val;
    });
  
  
    handlebars.registerHelper('toFixed', (number: number, digits: number) => Number(number).toFixed(digits));
  
    handlebars.registerHelper('isBundle', (childComponents: any[], options: any) => {
        // A product is a bundle if one of the child components itself contains a ChildComponents array with more than one element
        if (!Array.isArray(childComponents)) return false;

        const bundleElements = childComponents.filter((element: any) => {
            return element.ChildComponents && Array.isArray(element.ChildComponents) && element.ChildComponents.length > 0;
        });

        return bundleElements && bundleElements.length > 0;
    });

    handlebars.registerHelper('isProductElement', (childComponent: any, options: any) => {
        return childComponent.ChildComponents && Array.isArray(childComponent.ChildComponents) && childComponent.ChildComponents.length > 0;
    });

    handlebars.registerHelper('orderContainsTimeBasedSaleUnit', (lines: any[], options: any) => {
        if (!Array.isArray(lines)) return false;

        const saleitemUnitProperty = 'SaleitemUnit';
        // Based on Feature.SCP.Cart.Models.JsonResults.CartLineJsonResult
        const saleitemTimeUnits = ['PerHour', 'PerDay', 'PerMonth', 'PerMinute', 'Per15Minute', 'PerWeek', 'Per10Minute', 'PerYear'];

        const found = lines.filter((line: any) => {
            // Check if one of the main products is time based
            const mainProductIsTimeBased = line.ChildComponents && Array.isArray(line.ChildComponents) && line.ChildComponents.length > 0
                && line.ChildComponents.find((element: any) => {
                    return element.hasOwnProperty(saleitemUnitProperty) && saleitemTimeUnits.indexOf(element[saleitemUnitProperty]) >= 0;
                }) != null;

            // Check if one of the bundles contains time based items
            const bundleContainsTimeBased = lines.filter((line: any) => {
                return line.ChildComponents && Array.isArray(line.ChildComponents) && line.ChildComponents.length > 0
                    && line.ChildComponents.find((subLine: any) => {
                        return subLine.ChildComponents && Array.isArray(subLine.ChildComponents) && subLine.ChildComponents.length > 0
                            && subLine.ChildComponents.find((element: any) => {
                                return element.hasOwnProperty(saleitemUnitProperty) && saleitemTimeUnits.indexOf(element[saleitemUnitProperty]) >= 0;
                            }) != null
                    }) != null;
            }).length > 0;

            return mainProductIsTimeBased || bundleContainsTimeBased;
        }).length > 0;

        return found;
    });

    handlebars.registerHelper('containsTimeBasedSaleUnit', (childComponents: any[], options: any) => {
        if (!Array.isArray(childComponents)) return false;

        const saleitemUnitProperty = 'SaleitemUnit';
        // Based on Feature.SCP.Cart.Models.JsonResults.CartLineJsonResult
        const saleitemTimeUnits = ['PerHour', 'PerDay', 'PerMonth', 'PerMinute', 'Per15Minute', 'PerWeek', 'Per10Minute', 'PerYear'];

        // Find saleitemUnit within self
        const mainSaleitemUnitIsTimeBased = childComponents.find((element: any) => {
            return element.hasOwnProperty(saleitemUnitProperty)  && saleitemTimeUnits.indexOf(element[saleitemUnitProperty]) >= 0;
        }) != null;

        // Find saleitemUnit within children
        const bundleElementsContainsTimeBased = childComponents.filter((element: any) => {
            return element.ChildComponents && Array.isArray(element.ChildComponents) && element.ChildComponents.length > 0
                && element.ChildComponents.find((element: any) => {
                    return element.hasOwnProperty(saleitemUnitProperty) && saleitemTimeUnits.indexOf(element[saleitemUnitProperty]) >= 0;
                });
        }).length > 0;

        return mainSaleitemUnitIsTimeBased || bundleElementsContainsTimeBased;
    });

    handlebars.registerHelper('orderContainsNonTimeBasedSaleUnit', (lines: any[], options: any) => {
        if (!Array.isArray(lines)) return false;

        const childComponentsProperty = 'ChildComponents';
        const saleitemUnitProperty = 'SaleitemUnit';
        // Based on Feature.SCP.Cart.Models.JsonResults.CartLineJsonResult
        const saleitemTimeUnits = ['PerHour', 'PerDay', 'PerMonth', 'PerMinute', 'Per15Minute', 'PerWeek', 'Per10Minute', 'PerYear'];

        const found = lines.filter((line: any) => {
            // Check if one of the main products is time based
            const mainProductIsTimeBased = line.ChildComponents && Array.isArray(line.ChildComponents) && line.ChildComponents.length > 0
                && line.ChildComponents.find((element: any) => {
                    return element.hasOwnProperty(saleitemUnitProperty) && saleitemTimeUnits.indexOf(element[saleitemUnitProperty]) === -1;
                }) != null;

            // Check if one of the bundles contains time based items
            const bundleContainsTimeBased = lines.filter((line: any) => {
                return line.ChildComponents && Array.isArray(line.ChildComponents) && line.ChildComponents.length > 0
                    && line.ChildComponents.find((subLine: any) => {
                        return subLine.ChildComponents && Array.isArray(subLine.ChildComponents) && subLine.ChildComponents.length > 0
                            && subLine.ChildComponents.find((element: any) => {
                                return element.hasOwnProperty(saleitemUnitProperty) && saleitemTimeUnits.indexOf(element[saleitemUnitProperty]) === -1;
                            }) != null
                    }) != null;
            }).length > 0;

            return mainProductIsTimeBased || bundleContainsTimeBased;
        }).length > 0;

        return found;
    });

    handlebars.registerHelper('containsNonTimeBasedSaleUnit',  (childComponents: any[], options: any) => {
        if (!Array.isArray(childComponents)) return false;

        const saleitemUnitProperty = 'SaleitemUnit';
        // Based on Feature.SCP.Cart.Models.JsonResults.CartLineJsonResult
        const saleitemTimeUnits = ['PerHour', 'PerDay', 'PerMonth', 'PerMinute', 'Per15Minute', 'PerWeek', 'Per10Minute', 'PerYear'];

        // Find saleitemUnit within self
        const mainSaleitemUnitIsTimeBased = childComponents.find((element: any) => {
            return element.hasOwnProperty(saleitemUnitProperty)  && saleitemTimeUnits.indexOf(element[saleitemUnitProperty]) === -1;
        }) != null;

        // Find saleitemUnit within children
        const bundleElementsContainsTimeBased = childComponents.filter((element: any) => {
            return element.ChildComponents && Array.isArray(element.ChildComponents) && element.ChildComponents.length > 0
                && element.ChildComponents.find((element: any) => {
                    return element.hasOwnProperty(saleitemUnitProperty) && saleitemTimeUnits.indexOf(element[saleitemUnitProperty]) === -1;
                });
        }).length > 0;

        return mainSaleitemUnitIsTimeBased || bundleElementsContainsTimeBased;
    });

    handlebars.registerHelper('getLogoUrl', (brand: string, baseUrl: string) => {
        baseUrl = baseUrl.replace(/\/$/, '');

        let supportedDomains: {subDomain: string, brand: string}[] = [
            { "subDomain": "acme", "brand": "ACME"}, // local development
            { "subDomain": "azurewebsites", "brand": "ACME"}, // TST/UAT without friendly hostnames
            { "subDomain": "myacme", "brand": "ACME"},
            { "subDomain": "mycoyote", "brand": "Coyote"},
        ];

        let matchedDomain: {subDomain: string, brand: string} = supportedDomains.find(d => baseUrl.includes(d.subDomain) || (brand && brand.toLocaleLowerCase() === d.brand.toLocaleLowerCase()));

        if (!matchedDomain) {
            return`${baseUrl}/~/media/Logo-Images/Email/default_logo.png`;
        } else {
            return `${baseUrl}/~/media/Logo-Images/Email/${matchedDomain.brand.toLocaleLowerCase().replace(' ', '_')}_logo.png`;
        }
    });

    handlebars.registerHelper('bracket', function(num, options = num) {
        const i = Number.isInteger(num) ? num : 1;
        const open = '{'.repeat(i); 
        const close = '}'.repeat(i);
        return `${open}${options.fn(this)}${close}`;
    });

    handlebars.registerHelper('insertZeroWidthJoiners', (textToUpdate: string) => {
        let tempTextArray: string[] = [];
        const insertAt: number = 2;
        const zeroWidthJoiner: string = "&zwj;";
     
        for(let i: number = 0, len: number = textToUpdate.length; i < len; i += insertAt) {
            tempTextArray.push(textToUpdate.substr(i, insertAt))
        }
    
        return tempTextArray.join(zeroWidthJoiner);
    });
}

export default registerHelpers;