# rc3-map-scraper

scraping every room of rc3 world


## [1_scrape.js](https://github.com/MichaelKreil/rc3-21-map-scraper/blob/main/1_scrape.js)

- scrapes every room
- finds links to more rooms (function `scanForMapUrls`)
- generates screenshots (function `generateScreenshot`)

## [2_layouting.js](https://github.com/MichaelKreil/rc3-21-map-scraper/blob/main/2_layouting.js)

- Uses force-directed graph layouting to arrange all rooms in one map.
- Starts with a rough layout and gradually increases the repulsion forces to prevent overlaps.
- The result is saved by `exportVRT()` as [images/map.vrt](https://github.com/MichaelKreil/rc3-21-map-scraper/blob/main/images/map.vrt) in a [VRT (GDAL Virtual) format](https://gdal.org/drivers/raster/vrt.html)

## [3_render_map.sh](https://github.com/MichaelKreil/rc3-21-map-scraper/blob/main/3_render_map.sh)

- Uses [`gdal_translate`](https://gdal.org/programs/gdal_translate.html) to merge all the room images described in `map.vrt` as a large GeoTIFF, since GeoTIFF can handle the size of 131'072 x 131'072.

## [4_generate_tiles.sh](https://github.com/MichaelKreil/rc3-21-map-scraper/blob/main/4_generate_tiles.sh)

- Uses [`gdal2tiles.html`](https://gdal.org/programs/gdal2tiles.html) to split and merge the GeoTIFF into a tree of map tiles.

## [5_optimize.sh](https://github.com/MichaelKreil/rc3-21-map-scraper/blob/main/5_optimize.sh)

- Reduces the size of the tile tree down to 20% by:
	1. deleting all empty tiles (black tiles with the same md5 hash). Leaflet takes care of missing tiles by using the layer option [`errorTileUrl`](https://leafletjs.com/reference.html#tilelayer-errortileurl),
	2. using [`pngquant`](https://pngquant.org) to reduce the file size of the remaining tiles.
