#!/bin/bash

gdal_translate -r nearest -co TILED=YES -co COMPRESS=DEFLATE -co ZLEVEL=1 images/map.vrt images/map.tif
