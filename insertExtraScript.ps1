$cyberChefFile = Resolve-Path '.\static\CyberChef_v8.31.4.html'
$data = Get-Content -Path $cyberChefFile

$data = $data.Replace("</body>", '<script src="inject.js"></script></body>')

Set-Content -Path $cyberChefFile -Value $data -Encoding ASCII