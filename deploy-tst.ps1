# publish the code
$resourceGroup = "<Azure resource group>"
$functionAppName = "<Function App name>"
$publishFolder = "$PSScriptRoot\dist-deploy"

# create the zip
$publishZip = "$PSScriptRoot\func.zip"
if(Test-path $publishZip) {Remove-item $publishZip}
Add-Type -assembly "system.io.compression.filesystem"
[io.compression.zipfile]::CreateFromDirectory($publishFolder, $publishZip)

# deploy the zipped package
az functionapp deployment source config-zip `
 -g $resourceGroup -n $functionAppName --src $publishZip