#!/bin/bash

echo "scan for files"
find docs/tiles -name "*.png" > files.tmp

echo "scan for folders"
sed 's/[0-9]*\.png//g' files.tmp | sort -u > folders.tmp

echo "find empty files"
cat folders.tmp | parallel --bar --eta md5sum "{}*" | grep 'f6657865393ff950945cf650b2bde484' | sed 's/^[0-9a-f]* *//g' > delete_files.tmp

echo "delete empty files"
pv -pet delete_files.tmp | tr \\n \\0 | xargs -0 rm

echo "scan for files again"
find docs/tiles -name "*.png" > files.tmp

echo "optimize pngs"
cat files.tmp | parallel --bar --eta pngquant -f --ext ".png" "{}"

echo "delete temporary files"
rm *.tmp
