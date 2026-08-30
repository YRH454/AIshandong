$dir = 'C:\Users\35399\AppData\Local\Temp\rhyme-auth-bg-gallery-v4'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$items = @(
  @('01','library-pexels','https://images.pexels.com/photos/1290141/pexels-photo-1290141.jpeg?auto=compress&cs=tinysrgb&w=1400'),
  @('02','study-room-pexels','https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=1400'),
  @('03','desk-pexels','https://images.pexels.com/photos/590493/pexels-photo-590493.jpeg?auto=compress&cs=tinysrgb&w=1400'),
  @('04','reading-pexels','https://images.pexels.com/photos/3747468/pexels-photo-3747468.jpeg?auto=compress&cs=tinysrgb&w=1400'),
  @('05','open-book-pexels','https://images.pexels.com/photos/159872/book-open-pages-literature-159872.jpeg?auto=compress&cs=tinysrgb&w=1400')
)
foreach ($item in $items) {
  $path = Join-Path $dir ("$($item[0])-$($item[1]).jpg")
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $item[2] -OutFile $path -TimeoutSec 30
    Write-Output "$($item[0]) $((Get-Item -LiteralPath $path).Length)"
  } catch { Write-Output "$($item[0]) fail $($_.Exception.Message)" }
}
