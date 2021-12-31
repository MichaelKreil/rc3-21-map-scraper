#!/bin/bash

gdal_translate -r nearest -co TILED=YES -co COMPRESS=DEFLATE -co PREDICTOR=2 -co ZLEVEL=9 images/map.vrt images/map.tif
