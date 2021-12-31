#!/bin/bash

gdal2tiles.py -p raster -z 0-9 -e --tilesize=256 -w leaflet images/map.tif docs/tiles/
