# Sitecore Experience Commerce Order mail template
The Order mail template is an example of a transactional email template for a Sitecore Experience Commerce order.
In this case the order is for a service.

The order data is expanded with the following custom information:
- StartDate - when will the service need to be effective
- SaleitemUnit - is the service priced `PerItem` or `PerMonth`

A service product can be a bundle with a "setup" product with type `PerItem` and a recurring fee with type `PerMonth`. The one-off and recurring fees are split in this example email template.

# Rendering product images with SiteCore
In the order images are referenced by GUID. Url's to products can be rendered based on this GUID as follows:

```
https://we-sitecorexc10-tstpoc-cd-app-01.azurewebsites.net/~/media/CD6FCBEDBF0B4E27ACE36314A4E82906.ashx
```

where `Image.SitecoreId` with value `CD6FCBED-BF0B-4E27-ACE3-6314A4E82906` should have all `-` characters replace by nothing.
