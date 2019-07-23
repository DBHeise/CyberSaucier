[CmdletBinding()]
param(
	[Parameter(Mandatory=$true)][String] $cyberChefFile	
)
$data = Get-Content -Path $cyberChefFile

$data = $data.Replace("</body>", '<script src="saucier.js"></script></body>')

Set-Content -Path $cyberChefFile -Value $data -Encoding ASCII