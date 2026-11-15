param(
    [string]$Destino = (Join-Path $env:APPDATA "Preguntones")
)

$ErrorActionPreference = "Stop"

$archivos = @(
    @{
        Url = "https://cdn.modrinth.com/data/YL57xq9U/versions/sZbVsl2Q/iris-fabric-1.11.4%2Bmc26.1.2.jar"
        Ruta = Join-Path $Destino "mods\iris-fabric-1.11.4+mc26.1.2.jar"
        Sha512 = "d99b309d282edb1266dfbdfeda792beba1f808334489604818d6b298c328393dcd7eb5b28a56cea14c9cf8e4eb9c088cb2e80b228b3427a836d154a368b1bcb9"
    },
    @{
        Url = "https://cdn.modrinth.com/data/AANobbMI/versions/tZQ3jqnf/sodium-fabric-0.9.2%2Bmc26.1.2.jar"
        Ruta = Join-Path $Destino "mods\sodium-fabric-0.9.2+mc26.1.2.jar"
        Sha512 = "9a3cbc8111979fb2cada74d4df24867f4a8a76053b28d76796f0d1c9156cfc96c4f7d88b07072aea8d9574d46b5bc3ebf3b4d23c09c501f0089ee37681743475"
    },
    @{
        Url = "https://cdn.modrinth.com/data/HVnmMxH1/versions/Bqen1mJX/ComplementaryReimagined_r5.9.3.zip"
        Ruta = Join-Path $Destino "shaderpacks\ComplementaryReimagined_r5.9.3.zip"
        Sha512 = "45304b1d7862afdb2177b7e6226fc9c6737911d17a4ad46cc9c519ca4deb935f05072cd337cd8b19a15bb8062b57b54eceec7bdee4cd572d94858e2946d37d85"
    }
)

New-Item -ItemType Directory -Force -Path (Join-Path $Destino "mods"), (Join-Path $Destino "shaderpacks"), (Join-Path $Destino "config") | Out-Null

foreach ($archivo in $archivos) {
    Write-Host "Bajando $($archivo.Ruta)"
    & curl.exe -fsSL --retry 3 -o $archivo.Ruta $archivo.Url
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo bajar $($archivo.Url)"
    }
    $suma = (Get-FileHash -Algorithm SHA512 -Path $archivo.Ruta).Hash.ToLower()
    if ($suma -ne $archivo.Sha512) {
        Remove-Item -Force $archivo.Ruta
        throw "El archivo bajado no coincide con Modrinth: $($archivo.Ruta)"
    }
}

$iris = @"
#This file stores configuration options for Iris, such as the currently active shaderpack
allowUnknownShaders=false
colorSpace=SRGB
disableUpdateMessage=false
enableDebugOptions=false
enableShaders=true
maxShadowRenderDistance=32
shaderPack=ComplementaryReimagined_r5.9.3.zip
"@
Set-Content -Path (Join-Path $Destino "config\iris.properties") -Value $iris -Encoding Ascii

$hex = "0A0000090007736572766572730A0000000108000269700013706C61792E70726567756E746F6E65732E65730800046E616D65000B50726567756E746F6E657301000E6163636570745465787475726573010000"
$servidores = New-Object byte[] ($hex.Length / 2)
for ($i = 0; $i -lt $servidores.Length; $i++) {
    $servidores[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16)
}
[System.IO.File]::WriteAllBytes((Join-Path $Destino "servers.dat"), $servidores)

$leeme = @"
Preguntones, con luz y sombras.

1. En el lanzador que ya usas, elige Fabric 26.1.2. La version sola no enciende el shader. No actives OptiFine.
2. En esa version, la carpeta del juego es esta:
   $Destino
3. Pulsa Jugar. Tu nombre en el lanzador es tu nombre dentro. Preguntones ya esta en Multijugador.
4. Al conectar, acepta el pack del cofre. Sin el, no entras.

El shader es Complementary Reimagined r5.9.3, de Complementary Development.
Se bajo de Modrinth tal cual. Si esta carpeta falla, la responsabilidad es de Preguntones.
https://www.complementary.dev/
"@
Set-Content -Path (Join-Path $Destino "LEEME.txt") -Value $leeme -Encoding UTF8

Write-Host "Listo: $Destino"
if (-not $env:PREGUNTONES_SIN_CARPETA) {
    Start-Process -FilePath explorer.exe -ArgumentList $Destino
}
